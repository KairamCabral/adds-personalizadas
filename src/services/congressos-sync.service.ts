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

export interface BackfillParams {
  clientId: string;
  registrationId: string;
  currentTinyId: number | null;
  currentOrigin: string | null;
  tinyId: number;
  nowTs: string;
}

/**
 * Ponto ÚNICO que associa o `tiny_id` ao client casado, chamado SEMPRE após a
 * resolução do tiny_id (busca prévia, criação nova ou fallback "já existe").
 * Retorna o client efetivo (id + origin atual) para a promoção usar.
 *
 * - Se o client já tem esse tiny_id → no-op.
 * - Se tem outro tiny_id → não sobrescreve (log).
 * - Se não tem → grava tiny_id + tiny_synced_at.
 * - Se o UNIQUE(tiny_id) conflita (outra DUPLICATA do documento já carrega esse
 *   tiny_id) → RECONCILIA: reaponta `event_registrations.matched_client_id` para
 *   o client que já tem o tiny_id e retorna esse client (não falha o job).
 */
export async function backfillMatchedClientTinyId(
  admin: AdminClient,
  params: BackfillParams
): Promise<{ clientId: string; origin: string | null }> {
  const { clientId, registrationId, currentTinyId, currentOrigin, tinyId, nowTs } =
    params;

  if (currentTinyId === tinyId) return { clientId, origin: currentOrigin };
  if (currentTinyId != null) {
    console.warn(
      `[congress-sync] client ${clientId} já tem tiny_id ${currentTinyId} (≠ ${tinyId}) — não sobrescreve`
    );
    return { clientId, origin: currentOrigin };
  }

  const { error } = await admin
    .from("clients")
    .update({ tiny_id: tinyId, tiny_synced_at: nowTs })
    .eq("id", clientId);
  if (!error) return { clientId, origin: currentOrigin };

  // UNIQUE(tiny_id): outra duplicata de documento já carrega esse tiny_id.
  const { data: owner } = await admin
    .from("clients")
    .select("id, origin")
    .eq("tiny_id", tinyId)
    .maybeSingle();
  if (owner?.id) {
    await admin
      .from("event_registrations")
      .update({ matched_client_id: owner.id })
      .eq("id", registrationId);
    console.warn(
      `[congress-sync] tiny_id ${tinyId} já pertence ao client ${owner.id}; reaponta registration ${registrationId} (duplicata ${clientId})`
    );
    return { clientId: owner.id, origin: owner.origin ?? null };
  }

  console.warn(
    `[congress-sync] não gravou tiny_id ${tinyId} no client ${clientId}: ${error.message}`
  );
  return { clientId, origin: currentOrigin };
}

type SyncJobRow = { id: string; registration_id: string; attempts: number };

function emptyResult(): CongressSyncResult {
  return { processed: 0, done: 0, promoted: 0, skippedTiny: 0, failed: 0, dead: 0 };
}

/**
 * Processa UM job da fila: cria/acha o contato no Tiny (todos os participantes)
 * e — só para qualificados — promove a `client` no CRM com origem "congresso".
 * Usado tanto pelo cron (drain em lote) quanto pelo fast-path after() (1 job).
 */
async function processSingleJob(
  admin: AdminClient,
  job: SyncJobRow,
  nowIso: string,
  result: CongressSyncResult
): Promise<void> {
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
      return;
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

    // Associa/backfill o tiny_id no cliente casado — roda em TODOS os caminhos
    // de resolução (busca prévia, criação nova e fallback "já existe"). Em
    // conflito de UNIQUE(tiny_id) por duplicata, reaponta para o client dono.
    let effClientId = existingClient?.id ?? null;
    let effOrigin = existingClient?.origin ?? null;
    if (existingClient && tinyId != null) {
      const eff = await backfillMatchedClientTinyId(admin, {
        clientId: existingClient.id,
        registrationId: reg.id,
        currentTinyId: existingClient.tiny_id,
        currentOrigin: existingClient.origin,
        tinyId,
        nowTs,
      });
      effClientId = eff.clientId;
      effOrigin = eff.origin;
    }

    // Promoção a client — só qualificados (Dentista/Distribuidora)
    if (reg.qualified && tinyId != null) {
      const origin = slug ? `congresso:${slug}` : "congresso";

      if (existingClient) {
        await admin
          .from("clients")
          .update({
            origin: effOrigin ?? origin,
            tiny_synced_at: nowTs,
          })
          .eq("id", effClientId ?? existingClient.id);
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
          effClientId = clientId;
        }
        result.promoted++;
      }
    }

    // Cashback (E6): liga o crédito ao cliente casado/promovido, se ainda estiver
    // solto. O crédito pode nascer no cadastro sem client_id (participante que só
    // vira `client` aqui na promoção); o guard `is null` evita reescrever um já
    // ligado. No-op quando não há cashback/crédito.
    if (effClientId) {
      await admin
        .from("event_credits")
        .update({ client_id: effClientId })
        .eq("registration_id", reg.id)
        .is("client_id", null);
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

/**
 * Drena `tiny_contact_sync_jobs` (cron): processa até BATCH_LIMIT jobs vencidos
 * (status PENDING/FAILED com next_attempt_at <= agora). Retentativas com backoff.
 */
export async function processCongressSyncJobs(): Promise<CongressSyncResult> {
  const admin = createAdminClient();
  const result = emptyResult();
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
    await processSingleJob(admin, job, nowIso, result);
  }

  return result;
}

/**
 * Fast-path do after() na rota de registro: processa imediatamente o job do
 * cadastro recém-criado (near-real-time), sem esperar o cron diário. Trata só o
 * SEU job (o PROCESSING guarda contra reprocesso concorrente do cron). Nunca
 * lança para o chamador tratar como best-effort.
 */
export async function syncRegistrationNow(
  registrationId: string
): Promise<CongressSyncResult> {
  const admin = createAdminClient();
  const result = emptyResult();
  const nowIso = new Date().toISOString();

  const { data: job } = await admin
    .from("tiny_contact_sync_jobs")
    .select("id, registration_id, attempts")
    .eq("registration_id", registrationId)
    .in("status", ["PENDING", "FAILED"])
    .maybeSingle();

  if (!job) return result;
  await processSingleJob(admin, job, nowIso, result);
  return result;
}
