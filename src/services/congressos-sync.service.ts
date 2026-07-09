import { createAdminClient } from "@/lib/supabase/admin";
import { createOrFindTinyContact } from "@/lib/tiny/contacts";
import { TinyTokenExpiredError } from "@/lib/tiny-api";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface CongressSyncResult {
  processed: number;
  done: number;
  promoted: number;
  skippedTiny: number;
  failed: number;
  dead: number;
}

const BACKOFF_MINUTES = [1, 2, 4, 8, 16];
const MAX_ATTEMPTS = 5;
const BATCH_LIMIT = 100;

function backoffIso(attempts: number): string {
  const min =
    BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] ?? 16;
  return new Date(Date.now() + min * 60_000).toISOString();
}

async function logSync(
  admin: AdminClient,
  registrationId: string,
  tinyId: number | null,
  status: "success" | "error",
  errorMessage: string | null
) {
  await admin.from("tiny_sync_logs").insert({
    entity_type: "event_registration",
    entity_id: registrationId,
    tiny_id: tinyId,
    direction: "crm_to_tiny",
    status,
    error_message: errorMessage,
  });
}

/**
 * Ponto ÚNICO que grava `tiny_id` + `tiny_synced_at` no client casado quando ele
 * ainda não tem. Chamado após a resolução do tiny_id (busca prévia, criação nova
 * ou fallback "já existe"). Trata o conflito de `UNIQUE(clients.tiny_id)` — quando
 * outra duplicata de documento já carrega esse tiny_id — apenas logando, sem
 * falhar o job. Não sobrescreve um tiny_id diferente já existente.
 */
export async function backfillMatchedClientTinyId(
  admin: AdminClient,
  clientId: string,
  currentTinyId: number | null,
  tinyId: number,
  nowTs: string
): Promise<void> {
  if (currentTinyId === tinyId) return;
  if (currentTinyId != null) {
    console.warn(
      `[congress-sync] client ${clientId} já tem tiny_id ${currentTinyId} (≠ ${tinyId}) — não sobrescreve`
    );
    return;
  }
  const { error } = await admin
    .from("clients")
    .update({ tiny_id: tinyId, tiny_synced_at: nowTs })
    .eq("id", clientId);
  if (error) {
    // UNIQUE(tiny_id): outra duplicata de documento já tem esse tiny_id — segue.
    console.warn(
      `[congress-sync] não gravou tiny_id ${tinyId} no client ${clientId} (provável duplicata com UNIQUE tiny_id): ${error.message}`
    );
  }
}

/**
 * Drena `tiny_contact_sync_jobs`: para cada job, cria/acha o contato no Tiny
 * (todos os participantes) e — só para qualificados — promove a `client` no CRM
 * com marcador de origem "congresso". Retentativas com backoff; idempotente.
 */
export async function processCongressSyncJobs(): Promise<CongressSyncResult> {
  const admin = createAdminClient();
  const result: CongressSyncResult = {
    processed: 0,
    done: 0,
    promoted: 0,
    skippedTiny: 0,
    failed: 0,
    dead: 0,
  };
  const nowIso = new Date().toISOString();

  const { data: jobs, error } = await admin
    .from("tiny_contact_sync_jobs")
    .select("id, registration_id, attempts")
    .in("status", ["PENDING", "FAILED"])
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) throw error;
  if (!jobs || jobs.length === 0) return result;

  for (const job of jobs) {
    result.processed++;
    try {
      await admin
        .from("tiny_contact_sync_jobs")
        .update({ status: "PROCESSING" })
        .eq("id", job.id);

      const { data: reg } = await admin
        .from("event_registrations")
        .select(
          "id, edition_id, document, name, email, phone, contact_type, qualified, matched_client_id"
        )
        .eq("id", job.registration_id)
        .maybeSingle();

      if (!reg) {
        // registro sumiu (cascade) — nada a fazer
        await admin
          .from("tiny_contact_sync_jobs")
          .update({ status: "DONE", last_error: null })
          .eq("id", job.id);
        result.done++;
        continue;
      }

      const { data: ed } = await admin
        .from("event_editions")
        .select("slug")
        .eq("id", reg.edition_id)
        .maybeSingle();
      const slug = ed?.slug ?? null;

      // Resolve tiny_id — pula o Tiny se o cliente casado já tem tiny_id
      let tinyId: number | null = null;
      let skipTiny = false;
      let existingClient: {
        id: string;
        tiny_id: number | null;
        origin: string | null;
      } | null = null;

      if (reg.matched_client_id) {
        const { data: c } = await admin
          .from("clients")
          .select("id, tiny_id, origin")
          .eq("id", reg.matched_client_id)
          .maybeSingle();
        existingClient = c ?? null;
        if (c?.tiny_id) {
          tinyId = c.tiny_id;
          skipTiny = true;
        }
      }

      if (!skipTiny) {
        const res = await createOrFindTinyContact({
          name: reg.name,
          document: reg.document,
          phone: reg.phone,
          email: reg.email,
          sales_channel: reg.contact_type,
        });
        tinyId = res.tiny_id;
        if (tinyId == null) {
          throw new Error("Tiny não retornou id do contato");
        }
      } else {
        result.skippedTiny++;
      }

      const nowTs = new Date().toISOString();

      // Backfill centralizado do tiny_id no cliente casado — roda em TODOS os
      // caminhos de resolução (busca prévia, criação nova e fallback "já existe").
      if (existingClient && tinyId != null) {
        await backfillMatchedClientTinyId(
          admin,
          existingClient.id,
          existingClient.tiny_id,
          tinyId,
          nowTs
        );
        if (existingClient.tiny_id == null) existingClient.tiny_id = tinyId;
      }

      // Promoção a client — só qualificados (Dentista/Distribuidora)
      if (reg.qualified && tinyId != null) {
        const origin = slug ? `congresso:${slug}` : "congresso";

        if (existingClient) {
          await admin
            .from("clients")
            .update({
              origin: existingClient.origin ?? origin,
              tiny_synced_at: nowTs,
            })
            .eq("id", existingClient.id);
          result.promoted++;
        } else {
          // Pode existir um client com esse tiny_id (sincronizado antes) —
          // não clobberar os dados dele; só marca origem.
          const { data: byTiny } = await admin
            .from("clients")
            .select("id, origin")
            .eq("tiny_id", tinyId)
            .maybeSingle();

          let clientId: string | null = null;
          if (byTiny) {
            await admin
              .from("clients")
              .update({ origin: byTiny.origin ?? origin, tiny_synced_at: nowTs })
              .eq("id", byTiny.id);
            clientId = byTiny.id;
          } else {
            const digits = (reg.document ?? "").replace(/\D/g, "");
            const { data: inserted } = await admin
              .from("clients")
              .insert({
                name: reg.name ?? "Sem nome",
                document: digits || null,
                email: reg.email,
                phone: reg.phone,
                person_type: digits.length === 14 ? "JURIDICA" : "FISICA",
                sales_channel: reg.contact_type,
                tiny_id: tinyId,
                tiny_synced_at: nowTs,
                origin,
              })
              .select("id")
              .single();
            clientId = inserted?.id ?? null;
          }

          if (clientId) {
            await admin
              .from("event_registrations")
              .update({ matched_client_id: clientId })
              .eq("id", reg.id);
          }
          result.promoted++;
        }
      }

      await admin
        .from("tiny_contact_sync_jobs")
        .update({ status: "DONE", tiny_id: tinyId, last_error: null })
        .eq("id", job.id);
      await logSync(admin, reg.id, tinyId, "success", null);
      result.done++;
    } catch (err) {
      const msg =
        err instanceof TinyTokenExpiredError
          ? "Tiny desconectado — reconectar em Configurações > Integrações"
          : err instanceof Error
            ? err.message
            : String(err);
      const attempts = (job.attempts ?? 0) + 1;
      const dead = attempts >= MAX_ATTEMPTS;

      await admin
        .from("tiny_contact_sync_jobs")
        .update({
          status: dead ? "DEAD" : "FAILED",
          attempts,
          next_attempt_at: dead ? nowIso : backoffIso(attempts),
          last_error: msg,
        })
        .eq("id", job.id);
      await logSync(admin, job.registration_id, null, "error", msg);

      if (dead) result.dead++;
      else result.failed++;
    }
  }

  return result;
}
