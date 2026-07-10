/**
 * Congressos — drenagem da fila de confirmações (`event_dispatches`).
 * Envia o e-mail de confirmação do brinde (canal Resend, molde do NPS), registra
 * status/erro e reprocessa falhas transitórias com backoff.
 *
 * A fila é alimentada pela rota de cadastro (Épico 2). O envio near-real-time vem do
 * fast-path `after()` (`sendCongressDispatchNow`); o cron diário
 * (`processCongressDispatches`) é a rede de segurança para retries/backlog.
 *
 * Sem coluna `next_attempt_at` (que a fila de sync tem): reusa `scheduled_for` como
 * "próxima tentativa" + `attempts` como contador. Anti-corrida (fast-path × cron) via
 * claim atômico por UPDATE condicional (o enum de status não tem `PROCESSING`).
 */
import { resolveChannel } from "@/lib/congressos/channels";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCashbackEmailLabel } from "@/lib/congressos/cashback-format";
import type { EventDispatchChannel } from "@/lib/congressos/channels";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface DispatchRunResult {
  processed: number; // claimados e tentados
  sent: number; // ENVIADO
  failed: number; // falha transitória (segue PENDENTE p/ retry)
  dead: number; // terminal (FALHOU/CANCELADO)
}

const BACKOFF_MINUTES = [1, 2, 4, 8, 16];
const MAX_ATTEMPTS = 5;
const BATCH_LIMIT = 100;

function backoffIso(attempts: number): string {
  const min =
    BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] ?? 16;
  return new Date(Date.now() + min * 60_000).toISOString();
}

function firstName(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  return trimmed ? (trimmed.split(/\s+/)[0] ?? null) : null;
}

function emptyResult(): DispatchRunResult {
  return { processed: 0, sent: 0, failed: 0, dead: 0 };
}

type DispatchRow = {
  id: string;
  registration_id: string;
  channel: EventDispatchChannel;
  recipient: string | null;
  attempts: number;
};

const DISPATCH_COLS = "id, registration_id, channel, recipient, attempts";

/**
 * Marca falha: transitória (segue PENDENTE, será repescada pelo cron após o
 * `scheduled_for` já empurrado pelo claim) ou terminal (FALHOU ao atingir o limite).
 * Retorna `true` quando morreu (terminal).
 */
async function markFailure(
  admin: AdminClient,
  id: string,
  attempts: number,
  sendError: string
): Promise<boolean> {
  const dead = attempts >= MAX_ATTEMPTS;
  await admin
    .from("event_dispatches")
    .update({ status: dead ? "FALHOU" : "PENDENTE", send_error: sendError })
    .eq("id", id);
  return dead;
}

/**
 * Processa UM dispatch (usado pelo cron em lote e pelos fast-path/reenvio).
 * Inicia com um claim atômico: só quem consegue empurrar `scheduled_for` (com o
 * dispatch ainda PENDENTE e vencido) envia — evita e-mail duplicado numa corrida.
 */
async function processOne(
  admin: AdminClient,
  d: DispatchRow,
  nowIso: string,
  result: DispatchRunResult
): Promise<void> {
  const nextAttempts = (d.attempts ?? 0) + 1;

  // 1) Claim atômico (lock sem status PROCESSING): pré-agenda a próxima tentativa.
  const { data: claimed } = await admin
    .from("event_dispatches")
    .update({ attempts: nextAttempts, scheduled_for: backoffIso(nextAttempts) })
    .eq("id", d.id)
    .eq("status", "PENDENTE")
    .lte("scheduled_for", nowIso)
    .select("id")
    .maybeSingle();
  if (!claimed) return; // outro processo pegou (ou não está mais vencido)

  result.processed++;

  // 2) Canal + destinatário. Ausência é terminal (espelha o NPS).
  const channel = resolveChannel(d.channel);
  if (!d.recipient || !channel.isConfigured()) {
    await admin
      .from("event_dispatches")
      .update({
        status: "FALHOU",
        send_error: !channel.isConfigured()
          ? `Canal ${d.channel} não configurado`
          : "Sem destinatário",
      })
      .eq("id", d.id);
    result.dead++;
    return;
  }

  // 3) Contexto do e-mail (registro → edição + brinde).
  const { data: reg } = await admin
    .from("event_registrations")
    .select("id, name, edition_id, raffle_number")
    .eq("id", d.registration_id)
    .maybeSingle();

  if (!reg) {
    // registro removido (cascade normalmente já teria apagado o dispatch).
    await admin
      .from("event_dispatches")
      .update({ status: "CANCELADO", send_error: "Cadastro removido" })
      .eq("id", d.id);
    result.dead++;
    return;
  }

  const { data: ed } = await admin
    .from("event_editions")
    .select("name, gift_name")
    .eq("id", reg.edition_id)
    .maybeSingle();

  const { data: red } = await admin
    .from("event_gift_redemptions")
    .select("token, short_code")
    .eq("registration_id", reg.id)
    .maybeSingle();

  if (!red) {
    // Brinde ainda não disponível (não deveria ocorrer — criados juntos). Retry.
    const isDead = await markFailure(
      admin,
      d.id,
      nextAttempts,
      "Brinde ainda não disponível"
    );
    if (isDead) result.dead++;
    else result.failed++;
    return;
  }

  // Cashback (E6): se houver crédito ATIVO, anuncia no e-mail (senão, null → some).
  const { data: credit } = await admin
    .from("event_credits")
    .select("type, value, min_order_value, valid_until, status")
    .eq("registration_id", reg.id)
    .maybeSingle();

  // 4) Envio.
  const sendResult = await channel.send({
    to: d.recipient,
    participantFirstName: firstName(reg.name),
    editionName: ed?.name ?? null,
    giftName: ed?.gift_name ?? null,
    giftToken: red.token,
    shortCode: red.short_code,
    cashbackLabel: buildCashbackEmailLabel(credit, ed?.name ?? null),
    raffleNumber: reg.raffle_number ?? null,
  });

  if (sendResult.success) {
    await admin
      .from("event_dispatches")
      .update({
        status: "ENVIADO",
        sent_at: new Date().toISOString(),
        send_error: null,
      })
      .eq("id", d.id);
    result.sent++;
    return;
  }

  const isDead = await markFailure(
    admin,
    d.id,
    nextAttempts,
    sendResult.error ?? "Falha no envio"
  );
  if (isDead) result.dead++;
  else result.failed++;
}

/**
 * Drena `event_dispatches` (cron): processa até BATCH_LIMIT dispatches vencidos
 * (status PENDENTE com scheduled_for <= agora). Retentativas com backoff.
 */
export async function processCongressDispatches(): Promise<DispatchRunResult> {
  const admin = createAdminClient();
  const result = emptyResult();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from("event_dispatches")
    .select(DISPATCH_COLS)
    .eq("status", "PENDENTE")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) throw error;
  if (!due || due.length === 0) return result;

  for (const d of due as DispatchRow[]) {
    await processOne(admin, d, nowIso, result);
  }

  return result;
}

/**
 * Fast-path do after() na rota de registro: envia imediatamente a confirmação do
 * cadastro recém-criado (near-real-time), sem esperar o cron. Best-effort — nunca
 * lança para o chamador.
 */
export async function sendCongressDispatchNow(
  registrationId: string
): Promise<DispatchRunResult> {
  const admin = createAdminClient();
  const result = emptyResult();
  const nowIso = new Date().toISOString();

  try {
    const { data: d } = await admin
      .from("event_dispatches")
      .select(DISPATCH_COLS)
      .eq("registration_id", registrationId)
      .eq("status", "PENDENTE")
      .lte("scheduled_for", nowIso)
      .order("scheduled_for", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!d) return result;
    await processOne(admin, d as DispatchRow, nowIso, result);
  } catch (err) {
    console.error("[congressos-dispatch] sendCongressDispatchNow:", err);
  }

  return result;
}

/**
 * Reenvio manual (Story 4.3): reseta um dispatch terminal/enviado para PENDENTE com
 * budget de retry renovado e o processa. Seam para a UI do gestor (Épico 5).
 */
export async function resendDispatch(
  dispatchId: string
): Promise<DispatchRunResult> {
  const admin = createAdminClient();
  const result = emptyResult();
  const nowIso = new Date().toISOString();

  const { data: reset } = await admin
    .from("event_dispatches")
    .update({
      status: "PENDENTE",
      scheduled_for: nowIso,
      send_error: null,
      attempts: 0,
    })
    .eq("id", dispatchId)
    .in("status", ["FALHOU", "ENVIADO", "CANCELADO"])
    .select(DISPATCH_COLS)
    .maybeSingle();

  if (!reset) return result;
  await processOne(admin, reset as DispatchRow, nowIso, result);
  return result;
}
