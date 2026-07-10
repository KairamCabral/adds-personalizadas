import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

/**
 * Camada de dados do Épico 5 (Controle de Brindes). Usa o browser client
 * (RLS): MASTER/GESTOR/PRESTADOR podem SELECT `event_registrations` /
 * `event_gift_redemptions`; a retirada em si passa pelo RPC `redeem_gift`
 * (SECURITY DEFINER) porque PRESTADOR não tem UPDATE direto. O status de sync
 * no Tiny (`tiny_contact_sync_jobs`) só é legível por MASTER/GESTOR — por isso
 * só a lista de inscritos (gated `congressos.manage`) o consome.
 */
const supabase = createSupabaseClient();

type EventRegistration =
  Database["public"]["Tables"]["event_registrations"]["Row"];
type ContactType = EventRegistration["contact_type"];
type GiftStatus = Database["public"]["Enums"]["event_gift_status"];
type SyncStatus = Database["public"]["Enums"]["tiny_sync_job_status"];

/** Normaliza um embed do PostgREST que pode vir como objeto (1:1) ou array. */
function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

// ---- Lista de inscritos + brinde + sync (manage) ----

export interface RegistrationWithGift {
  id: string;
  name: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  contact_type: ContactType;
  qualified: boolean;
  created_at: string;
  gift_status: GiftStatus | null;
  short_code: string | null;
  token: string | null;
  redeemed_at: string | null;
  sync_status: SyncStatus | null;
}

interface RedemptionEmbed {
  token: string;
  short_code: string;
  status: GiftStatus;
  redeemed_at: string | null;
}
interface RegistrationRow {
  id: string;
  name: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  contact_type: ContactType;
  qualified: boolean;
  created_at: string;
  event_gift_redemptions: RedemptionEmbed | RedemptionEmbed[] | null;
}

export async function getEditionRegistrations(
  editionId: string
): Promise<RegistrationWithGift[]> {
  const { data, error } = await supabase
    .from("event_registrations")
    .select(
      "id, name, document, email, phone, contact_type, qualified, created_at, event_gift_redemptions(token, short_code, status, redeemed_at)"
    )
    .eq("edition_id", editionId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as RegistrationRow[];
  if (rows.length === 0) return [];

  // Status de sync no Tiny (1:1 por registration). Fetch separado + merge —
  // evita depender de FK detectável pelo PostgREST em tiny_contact_sync_jobs.
  const { data: jobs } = await supabase
    .from("tiny_contact_sync_jobs")
    .select("registration_id, status")
    .in(
      "registration_id",
      rows.map((r) => r.id)
    );
  const syncByReg = new Map<string, SyncStatus>();
  for (const j of jobs ?? []) syncByReg.set(j.registration_id, j.status);

  return rows.map((r) => {
    const red = pickOne(r.event_gift_redemptions);
    return {
      id: r.id,
      name: r.name,
      document: r.document,
      email: r.email,
      phone: r.phone,
      contact_type: r.contact_type,
      qualified: r.qualified,
      created_at: r.created_at,
      gift_status: red?.status ?? null,
      short_code: red?.short_code ?? null,
      token: red?.token ?? null,
      redeemed_at: red?.redeemed_at ?? null,
      sync_status: syncByReg.get(r.id) ?? null,
    };
  });
}

// ---- Busca para retirada no estande (operate) ----

export interface RedeemSearchResult {
  token: string;
  short_code: string;
  status: GiftStatus;
  redeemed_at: string | null;
  name: string | null;
  document: string | null;
  contact_type: ContactType;
}

interface RegEmbed {
  name: string | null;
  document: string | null;
  contact_type: ContactType;
}
interface RedemptionSearchRow {
  token: string;
  short_code: string;
  status: GiftStatus;
  redeemed_at: string | null;
  event_registrations: RegEmbed | RegEmbed[] | null;
}
interface RegistrationSearchRow {
  name: string | null;
  document: string | null;
  contact_type: ContactType;
  event_gift_redemptions: RedemptionEmbed | RedemptionEmbed[] | null;
}

const REDEMPTION_SELECT =
  "token, short_code, status, redeemed_at, event_registrations(name, document, contact_type)";
const REGISTRATION_SELECT =
  "name, document, contact_type, event_gift_redemptions(token, short_code, status, redeemed_at)";

/**
 * Resolve o brinde a partir do que o operador digitou/escaneou: token (QR),
 * código de 6 dígitos, CPF/CNPJ ou nome. Um leitor de código de barras USB
 * "digita" o valor e dá Enter — cai aqui igual.
 */
export async function searchGiftForRedeem(
  editionId: string,
  rawQuery: string
): Promise<RedeemSearchResult[]> {
  const q = rawQuery.trim();
  if (!q) return [];
  const digits = q.replace(/\D/g, "");

  // Token do QR (hex, 16+ chars)
  if (/^[a-f0-9]{16,}$/i.test(q)) {
    const { data, error } = await supabase
      .from("event_gift_redemptions")
      .select(REDEMPTION_SELECT)
      .eq("edition_id", editionId)
      .eq("token", q.toLowerCase());
    if (error) throw error;
    return fromRedemptionRows(data);
  }

  // Código de 6 dígitos (único por edição)
  if (digits.length === 6) {
    const { data, error } = await supabase
      .from("event_gift_redemptions")
      .select(REDEMPTION_SELECT)
      .eq("edition_id", editionId)
      .eq("short_code", digits);
    if (error) throw error;
    return fromRedemptionRows(data);
  }

  // CPF (11) ou CNPJ (14)
  if (digits.length === 11 || digits.length === 14) {
    const { data, error } = await supabase
      .from("event_registrations")
      .select(REGISTRATION_SELECT)
      .eq("edition_id", editionId)
      .eq("document", digits);
    if (error) throw error;
    return fromRegistrationRows(data);
  }

  // Nome (mín. 2 chars)
  if (q.length >= 2) {
    const { data, error } = await supabase
      .from("event_registrations")
      .select(REGISTRATION_SELECT)
      .eq("edition_id", editionId)
      .ilike("name", `%${q}%`)
      .order("name", { ascending: true })
      .limit(10);
    if (error) throw error;
    return fromRegistrationRows(data);
  }

  return [];
}

function fromRedemptionRows(data: unknown): RedeemSearchResult[] {
  const rows = (data ?? []) as unknown as RedemptionSearchRow[];
  return rows.map((r) => {
    const reg = pickOne(r.event_registrations);
    return {
      token: r.token,
      short_code: r.short_code,
      status: r.status,
      redeemed_at: r.redeemed_at,
      name: reg?.name ?? null,
      document: reg?.document ?? null,
      contact_type: reg?.contact_type ?? null,
    };
  });
}

function fromRegistrationRows(data: unknown): RedeemSearchResult[] {
  const rows = (data ?? []) as unknown as RegistrationSearchRow[];
  const out: RedeemSearchResult[] = [];
  for (const r of rows) {
    const red = pickOne(r.event_gift_redemptions);
    if (!red) continue; // registro sem brinde gerado ainda
    out.push({
      token: red.token,
      short_code: red.short_code,
      status: red.status,
      redeemed_at: red.redeemed_at,
      name: r.name,
      document: r.document,
      contact_type: r.contact_type,
    });
  }
  return out;
}

// ---- Retirada (RPC SECURITY DEFINER) ----

export type RedeemResult =
  Database["public"]["Functions"]["redeem_gift"]["Returns"][number];

/** Marca o brinde como RETIRADO de forma atômica. Retorna o outcome do RPC. */
export async function redeemGift(token: string): Promise<RedeemResult | null> {
  const { data, error } = await supabase.rpc("redeem_gift", {
    p_token: token,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

// ---- Edições ativas (para o picker do console de retirada) ----

export async function getActiveEditions() {
  const { data, error } = await supabase
    .from("event_editions")
    .select("id, name, slug, gift_name, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
