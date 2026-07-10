import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

/**
 * Sorteio (Épico 8) pela equipe. Browser client (RLS): MASTER/GESTOR/PRESTADOR
 * leem `event_raffle_draws`; o sorteio em si passa pelo RPC `raffle_draw`
 * (SECURITY DEFINER, atômico e auditável). A atribuição do número acontece no
 * cadastro (RPC `assign_raffle_number`), não aqui.
 */
const supabase = createSupabaseClient();

export type RaffleDrawResult =
  Database["public"]["Functions"]["raffle_draw"]["Returns"][number];

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

// ---- Sorteio (RPC) ----

export async function drawRaffleWinner(
  editionId: string,
  forDate?: string | null
): Promise<RaffleDrawResult | null> {
  const { data, error } = await supabase.rpc("raffle_draw", {
    p_edition_id: editionId,
    ...(forDate ? { p_for_date: forDate } : {}),
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

// ---- Histórico de ganhadores ----

export interface RaffleWinner {
  id: string;
  registration_id: string;
  participant_name: string | null;
  document: string | null;
  raffle_number: number | null;
  prize: string | null;
  pool_size: number | null;
  drawn_for_date: string | null;
  drawn_at: string;
}

interface DrawRow {
  id: string;
  registration_id: string;
  raffle_number: number | null;
  prize: string | null;
  pool_size: number | null;
  drawn_for_date: string | null;
  drawn_at: string;
  event_registrations:
    | { name: string | null; document: string | null }
    | { name: string | null; document: string | null }[]
    | null;
}

export async function getEditionDraws(
  editionId: string
): Promise<RaffleWinner[]> {
  const { data, error } = await supabase
    .from("event_raffle_draws")
    .select(
      "id, registration_id, raffle_number, prize, pool_size, drawn_for_date, drawn_at, event_registrations(name, document)"
    )
    .eq("edition_id", editionId)
    .order("drawn_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as DrawRow[]).map((d) => {
    const reg = pickOne(d.event_registrations);
    return {
      id: d.id,
      registration_id: d.registration_id,
      participant_name: reg?.name ?? null,
      document: reg?.document ?? null,
      raffle_number: d.raffle_number,
      prize: d.prize,
      pool_size: d.pool_size,
      drawn_for_date: d.drawn_for_date,
      drawn_at: d.drawn_at,
    };
  });
}

// ---- Contagem de inscritos numerados (dica de pool na UI) ----
// O pool exato (por elegibilidade/dia/ganhadores) é calculado no RPC; aqui é só
// a base "quantos têm número da sorte" para exibir antes de sortear.

export async function getRaffleNumberedCount(
  editionId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("event_registrations")
    .select("id", { count: "exact", head: true })
    .eq("edition_id", editionId)
    .not("raffle_number", "is", null);
  if (error) throw error;
  return count ?? 0;
}

// ---- Pool numerado (alimenta a roleta de suspense do telão) ----

export interface RafflePoolEntry {
  id: string;
  name: string | null;
  raffle_number: number;
}

export async function getRafflePool(
  editionId: string
): Promise<RafflePoolEntry[]> {
  const { data, error } = await supabase
    .from("event_registrations")
    .select("id, name, raffle_number")
    .eq("edition_id", editionId)
    .not("raffle_number", "is", null)
    .order("raffle_number", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as RafflePoolEntry[]).filter(
    (r) => r.raffle_number != null
  );
}
