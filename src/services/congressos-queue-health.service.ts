import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { QueueCounts } from "@/lib/congressos/queue-health";
import type { Database } from "@/types/database.types";

/**
 * Camada de leitura da saúde das filas (E7 / Story 7.1). Browser client sob RLS:
 * `tiny_contact_sync_jobs` e `event_dispatches` só são legíveis por MASTER/GESTOR
 * — por isso a página que consome isto é gated por `congressos.manage`.
 *
 * Contagens por status num único round-trip via RPC `congress_queue_counts`.
 * Listas de problemas (jobs MORTOS / e-mails FALHOS) limitadas e enriquecidas
 * com o evento + participante por fetch separado + merge (espelha
 * `getEditionRegistrations`, evitando embed FK que o PostgREST não detecta em
 * `tiny_contact_sync_jobs`).
 */
const supabase = createSupabaseClient();

type DispatchChannel = Database["public"]["Enums"]["event_dispatch_channel"];
type ContactType =
  Database["public"]["Tables"]["event_registrations"]["Row"]["contact_type"];

const PROBLEM_LIMIT = 50;

export interface DeadSyncJob {
  id: string;
  registration_id: string;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string | null;
  updated_at: string;
  participant_name: string | null;
  contact_type: ContactType | null;
  edition_name: string | null;
}

export interface FailedDispatch {
  id: string;
  registration_id: string;
  channel: DispatchChannel;
  recipient: string | null;
  attempts: number;
  send_error: string | null;
  updated_at: string;
  participant_name: string | null;
  edition_name: string | null;
}

export interface QueueHealth extends QueueCounts {
  deadJobs: DeadSyncJob[];
  failedDispatches: FailedDispatch[];
}

/**
 * Contagens das duas filas por status num único round-trip (RPC
 * `congress_queue_counts`, SECURITY INVOKER — respeita a RLS MASTER/GESTOR).
 * Substitui os 9 COUNTs separados.
 */
async function getQueueCounts(): Promise<QueueCounts> {
  const { data } = await supabase.rpc("congress_queue_counts");
  const r = data?.[0];
  return {
    sync: {
      pending: r?.sync_pending ?? 0,
      processing: r?.sync_processing ?? 0,
      failed: r?.sync_failed ?? 0,
      dead: r?.sync_dead ?? 0,
      done: r?.sync_done ?? 0,
    },
    dispatch: {
      pendente: r?.dispatch_pendente ?? 0,
      enviado: r?.dispatch_enviado ?? 0,
      falhou: r?.dispatch_falhou ?? 0,
      cancelado: r?.dispatch_cancelado ?? 0,
    },
  };
}

interface RegInfo {
  name: string | null;
  contact_type: ContactType | null;
  edition_name: string | null;
}

/** Busca nome/tipo do participante + nome da edição para um conjunto de registros. */
async function fetchRegInfo(
  registrationIds: string[]
): Promise<Map<string, RegInfo>> {
  const map = new Map<string, RegInfo>();
  if (registrationIds.length === 0) return map;

  const { data } = await supabase
    .from("event_registrations")
    .select("id, name, contact_type, event_editions(name)")
    .in("id", registrationIds);

  for (const r of (data ?? []) as unknown as Array<{
    id: string;
    name: string | null;
    contact_type: ContactType | null;
    event_editions: { name: string } | { name: string }[] | null;
  }>) {
    const ed = Array.isArray(r.event_editions)
      ? r.event_editions[0]
      : r.event_editions;
    map.set(r.id, {
      name: r.name,
      contact_type: r.contact_type,
      edition_name: ed?.name ?? null,
    });
  }
  return map;
}

async function getDeadJobs(): Promise<DeadSyncJob[]> {
  const { data } = await supabase
    .from("tiny_contact_sync_jobs")
    .select("id, registration_id, attempts, last_error, next_attempt_at, updated_at")
    .eq("status", "DEAD")
    .order("updated_at", { ascending: false })
    .limit(PROBLEM_LIMIT);

  const rows = data ?? [];
  const info = await fetchRegInfo(rows.map((r) => r.registration_id));
  return rows.map((r) => {
    const reg = info.get(r.registration_id);
    return {
      id: r.id,
      registration_id: r.registration_id,
      attempts: r.attempts,
      last_error: r.last_error,
      next_attempt_at: r.next_attempt_at,
      updated_at: r.updated_at,
      participant_name: reg?.name ?? null,
      contact_type: reg?.contact_type ?? null,
      edition_name: reg?.edition_name ?? null,
    };
  });
}

async function getFailedDispatches(): Promise<FailedDispatch[]> {
  const { data } = await supabase
    .from("event_dispatches")
    .select("id, registration_id, channel, recipient, attempts, send_error, updated_at")
    .eq("status", "FALHOU")
    .order("updated_at", { ascending: false })
    .limit(PROBLEM_LIMIT);

  const rows = data ?? [];
  const info = await fetchRegInfo(rows.map((r) => r.registration_id));
  return rows.map((r) => {
    const reg = info.get(r.registration_id);
    return {
      id: r.id,
      registration_id: r.registration_id,
      channel: r.channel,
      recipient: r.recipient,
      attempts: r.attempts,
      send_error: r.send_error,
      updated_at: r.updated_at,
      participant_name: reg?.name ?? null,
      edition_name: reg?.edition_name ?? null,
    };
  });
}

/** Agrega contagens + listas de problemas das duas filas para a tela de saúde. */
export async function getQueueHealth(): Promise<QueueHealth> {
  const [counts, deadJobs, failedDispatches] = await Promise.all([
    getQueueCounts(),
    getDeadJobs(),
    getFailedDispatches(),
  ]);
  return { ...counts, deadJobs, failedDispatches };
}
