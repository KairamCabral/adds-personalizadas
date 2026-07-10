import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

/**
 * Gestão de créditos de cashback (Épico 6) pela equipe (MASTER/GESTOR via RLS
 * `event_credits_manage`). Browser client — leitura na tela da edição e no
 * perfil do cliente, e resgate/cancelamento manual (update direto, sem RPC).
 * A expiração automática (cron/admin) vive em `congressos-credits-expiry.service.ts`.
 */
const supabase = createSupabaseClient();

type CashbackType = Database["public"]["Enums"]["event_cashback_type"];
type CreditStatus = Database["public"]["Enums"]["event_credit_status"];

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

// ---- Créditos de um cliente (perfil) ----

export interface ClientCredit {
  id: string;
  edition_id: string;
  edition_name: string | null;
  type: CashbackType;
  value: number;
  min_order_value: number | null;
  min_order_qty: number | null;
  valid_until: string | null;
  status: CreditStatus;
  redeemed_at: string | null;
  redeemed_order_id: string | null;
  created_at: string;
}

interface ClientCreditRow {
  id: string;
  edition_id: string;
  type: CashbackType;
  value: number;
  min_order_value: number | null;
  min_order_qty: number | null;
  valid_until: string | null;
  status: CreditStatus;
  redeemed_at: string | null;
  redeemed_order_id: string | null;
  created_at: string;
  event_editions: { name: string | null } | { name: string | null }[] | null;
}

export async function getClientCredits(
  clientId: string
): Promise<ClientCredit[]> {
  const { data, error } = await supabase
    .from("event_credits")
    .select(
      "id, edition_id, type, value, min_order_value, min_order_qty, valid_until, status, redeemed_at, redeemed_order_id, created_at, event_editions(name)"
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as ClientCreditRow[]).map((r) => ({
    id: r.id,
    edition_id: r.edition_id,
    edition_name: pickOne(r.event_editions)?.name ?? null,
    type: r.type,
    value: r.value,
    min_order_value: r.min_order_value,
    min_order_qty: r.min_order_qty,
    valid_until: r.valid_until,
    status: r.status,
    redeemed_at: r.redeemed_at,
    redeemed_order_id: r.redeemed_order_id,
    created_at: r.created_at,
  }));
}

// ---- Créditos de uma edição (tela da edição) ----

export interface EditionCredit {
  id: string;
  registration_id: string;
  client_id: string | null;
  participant_name: string | null;
  document: string | null;
  type: CashbackType;
  value: number;
  min_order_value: number | null;
  min_order_qty: number | null;
  valid_until: string | null;
  status: CreditStatus;
  redeemed_at: string | null;
  created_at: string;
}

interface EditionCreditRow {
  id: string;
  registration_id: string;
  client_id: string | null;
  type: CashbackType;
  value: number;
  min_order_value: number | null;
  min_order_qty: number | null;
  valid_until: string | null;
  status: CreditStatus;
  redeemed_at: string | null;
  created_at: string;
  event_registrations:
    | { name: string | null; document: string | null }
    | { name: string | null; document: string | null }[]
    | null;
}

export async function getEditionCredits(
  editionId: string
): Promise<EditionCredit[]> {
  const { data, error } = await supabase
    .from("event_credits")
    .select(
      "id, registration_id, client_id, type, value, min_order_value, min_order_qty, valid_until, status, redeemed_at, created_at, event_registrations(name, document)"
    )
    .eq("edition_id", editionId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as EditionCreditRow[]).map((r) => {
    const reg = pickOne(r.event_registrations);
    return {
      id: r.id,
      registration_id: r.registration_id,
      client_id: r.client_id,
      participant_name: reg?.name ?? null,
      document: reg?.document ?? null,
      type: r.type,
      value: r.value,
      min_order_value: r.min_order_value,
      min_order_qty: r.min_order_qty,
      valid_until: r.valid_until,
      status: r.status,
      redeemed_at: r.redeemed_at,
      created_at: r.created_at,
    };
  });
}

// ---- Resgate / cancelamento manual (update direto, RLS manage) ----

export async function updateCreditStatus(
  id: string,
  patch: { status: CreditStatus; redeemed_order_id?: string | null }
): Promise<void> {
  const update: Database["public"]["Tables"]["event_credits"]["Update"] =
    patch.status === "USADO"
      ? {
          status: "USADO",
          redeemed_at: new Date().toISOString(),
          redeemed_order_id: patch.redeemed_order_id ?? null,
        }
      : { status: patch.status, redeemed_at: null, redeemed_order_id: null };

  const { error } = await supabase
    .from("event_credits")
    .update(update)
    .eq("id", id);
  if (error) throw error;
}
