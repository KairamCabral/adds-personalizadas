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
  /** id do pré-cadastro — necessário para corrigir o telefone no balcão */
  registration_id: string;
  name: string | null;
  document: string | null;
  phone: string | null;
  contact_type: ContactType;
}

interface RegEmbed {
  id: string;
  name: string | null;
  document: string | null;
  phone: string | null;
  contact_type: ContactType;
}
interface RedemptionSearchRow {
  token: string;
  short_code: string;
  status: GiftStatus;
  redeemed_at: string | null;
  registration_id: string;
  event_registrations: RegEmbed | RegEmbed[] | null;
}
interface RegistrationSearchRow {
  id: string;
  name: string | null;
  document: string | null;
  phone: string | null;
  contact_type: ContactType;
  event_gift_redemptions: RedemptionEmbed | RedemptionEmbed[] | null;
}

const REDEMPTION_SELECT =
  "token, short_code, status, redeemed_at, registration_id, event_registrations(id, name, document, phone, contact_type)";
const REGISTRATION_SELECT =
  "id, name, document, phone, contact_type, event_gift_redemptions(token, short_code, status, redeemed_at)";

/**
 * Busca por sufixo de telefone (`phone_digits`, coluna gerada na migration
 * 20260915130000_congressos_confirm_code.sql).
 *
 * Falha de forma isolada: no balcão, um erro aqui não pode derrubar os outros
 * caminhos de busca (código, CPF, nome) que rodam na mesma consulta.
 */
async function searchByPhone(
  editionId: string,
  digits: string
): Promise<RedeemSearchResult[]> {
  const { data, error } = await supabase
    .from("event_registrations")
    .select(REGISTRATION_SELECT)
    .eq("edition_id", editionId)
    // TODO(types): tirar o cast depois de `pnpm db:types`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .like("phone_digits" as any, `%${digits}`)
    .order("name", { ascending: true })
    .limit(10);
  if (error) {
    console.warn("[congressos/retirada] busca por telefone:", error.message);
    return [];
  }
  return fromRegistrationRows(data);
}

/** Junta resultados de caminhos diferentes sem repetir o mesmo brinde. */
function mergeResults(...lists: RedeemSearchResult[][]): RedeemSearchResult[] {
  const byToken = new Map<string, RedeemSearchResult>();
  for (const list of lists) {
    for (const r of list) if (!byToken.has(r.token)) byToken.set(r.token, r);
  }
  return [...byToken.values()];
}

/**
 * Resolve o brinde a partir do que o operador digitou/escaneou: token (QR),
 * código de 6 dígitos, CPF/CNPJ, telefone ou nome. Um leitor de código de
 * barras USB "digita" o valor e dá Enter — cai aqui igual.
 *
 * CPF e celular têm os mesmos 11 dígitos: nesse caso os dois caminhos rodam e
 * os resultados são unidos (dedup por token).
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

  // Código de 6 dígitos (único por edição). Se não achar, ainda pode ser um
  // pedaço de telefone — cai no bloco de dígitos abaixo.
  if (digits.length === 6) {
    const { data, error } = await supabase
      .from("event_gift_redemptions")
      .select(REDEMPTION_SELECT)
      .eq("edition_id", editionId)
      .eq("short_code", digits);
    if (error) throw error;
    const found = fromRedemptionRows(data);
    if (found.length > 0) return found;
  }

  // CPF/CNPJ e/ou telefone
  if (digits.length >= 6 && digits.length <= 14) {
    const lists: RedeemSearchResult[][] = [];

    if (digits.length === 11 || digits.length === 14) {
      const { data, error } = await supabase
        .from("event_registrations")
        .select(REGISTRATION_SELECT)
        .eq("edition_id", editionId)
        .eq("document", digits);
      if (error) throw error;
      lists.push(fromRegistrationRows(data));
    }

    // 6–13 dígitos: sufixo do telefone (com ou sem DDD/DDI).
    if (digits.length <= 13) {
      lists.push(await searchByPhone(editionId, digits));
    }

    const merged = mergeResults(...lists);
    if (merged.length > 0 || digits.length === q.length) return merged;
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
      registration_id: r.registration_id,
      name: reg?.name ?? null,
      document: reg?.document ?? null,
      phone: reg?.phone ?? null,
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
      registration_id: r.id,
      name: r.name,
      document: r.document,
      phone: r.phone,
      contact_type: r.contact_type,
    });
  }
  return out;
}

// ---- Confirmação por WhatsApp (RPC SECURITY DEFINER) ----

/**
 * TODO(types): a migration 20260915130000 já está aplicada — os RPCs abaixo
 * entram em `database.types.ts` assim que `pnpm db:types` rodar. Até lá, uma
 * única porta de entrada não-tipada, aqui.
 */
type LooseRpc = (
  fn: string,
  args: Record<string, unknown>
) => Promise<{ data: unknown; error: { message: string } | null }>;

/**
 * Chama um RPC ainda ausente de `database.types.ts`.
 *
 * ⚠️ Tem que ser chamado como MÉTODO de `supabase`. Guardar `supabase.rpc`
 * numa variável desanexa o método e perde o `this` — o corpo do rpc faz
 * `return this.rest.rpc(...)` e estoura TypeError em runtime (o build passa).
 */
function looseRpc(fn: string, args: Record<string, unknown>) {
  return (supabase as unknown as { rpc: LooseRpc }).rpc(fn, args);
}

export interface IssueConfirmCodeResult {
  success: boolean;
  /** OK · SEM_TELEFONE · JA_RETIRADO · CANCELADO · NAO_ENCONTRADO · SEM_PERMISSAO */
  outcome: string;
  code: string | null;
  phone: string | null;
  participant_name: string | null;
  edition_name: string | null;
  gift_name: string | null;
}

/**
 * Emite (ou reaproveita, se tiver menos de 10 min e for o mesmo telefone) o
 * código de 4 dígitos que o operador manda pelo WhatsApp.
 */
export async function issueGiftConfirmCode(
  token: string
): Promise<IssueConfirmCodeResult | null> {
  const { data, error } = await looseRpc("issue_gift_confirm_code", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as IssueConfirmCodeResult[];
  return rows[0] ?? null;
}

// ---- Retirada (RPC SECURITY DEFINER) ----

export interface RedeemResult {
  success: boolean;
  /** RETIRADO · JA_RETIRADO · CANCELADO · CODIGO_INVALIDO · NAO_ENCONTRADO · SEM_PERMISSAO */
  outcome: string;
  redeemed_at: string | null;
  redeemed_by_name: string | null;
  /** CODIGO quando conferido no WhatsApp; SEM_CODIGO quando entregue direto */
  verification: string | null;
}

/**
 * Marca o brinde como RETIRADO de forma atômica. Com `confirmCode`, o RPC só
 * entrega se o código conferir (senão devolve CODIGO_INVALIDO sem consumir
 * nada). Sem código, a entrega acontece e fica registrada como SEM_CODIGO.
 */
export async function redeemGift(
  token: string,
  confirmCode?: string | null
): Promise<RedeemResult | null> {
  const { data, error } = await looseRpc("redeem_gift", {
    p_token: token,
    p_confirm_code: confirmCode ?? null,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RedeemResult[];
  return rows[0] ?? null;
}

// ---- Correção de telefone no balcão ----

export interface UpdatePhoneResult {
  success: boolean;
  phone: string;
  /** true quando o contato já foi sincronizado com o Tiny com o número antigo */
  tinyAlreadySynced: boolean;
}

/**
 * Corrige o telefone do pré-cadastro. Passa por rota de API (service role):
 * PRESTADOR só tem SELECT em `event_registrations` pela RLS.
 */
export async function updateRegistrationPhone(
  registrationId: string,
  phone: string
): Promise<UpdatePhoneResult> {
  const res = await fetch(
    `/api/congressos/registrations/${registrationId}/phone`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    }
  );
  const json = (await res.json().catch(() => null)) as
    | (UpdatePhoneResult & { error?: string })
    | null;
  if (!res.ok || !json?.success) {
    throw new Error(json?.error ?? "Não foi possível salvar o telefone.");
  }
  return json;
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
