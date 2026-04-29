import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { getOrderById } from "./orders.service";
import { hasValidAgreement } from "./agreements.service";
import { enqueueBlingRequest } from "@/lib/bling/rate-limiter";
import { formatProductWithColor } from "@/lib/products/format";

const supabase = createClient();

export type SharedFields = Record<
  | "client_name"
  | "client_document"
  | "client_street"
  | "client_number"
  | "client_complement"
  | "client_neighborhood"
  | "client_city"
  | "client_state"
  | "client_zip_code"
  | "order_products"
  | "order_quantities"
  | "order_personalization"
  | "order_due_date",
  boolean
>;

const SHARED_FIELDS_KEYS: (keyof SharedFields)[] = [
  "client_name", "client_document", "client_street", "client_number",
  "client_complement", "client_neighborhood", "client_city", "client_state",
  "client_zip_code", "order_products", "order_quantities",
  "order_personalization", "order_due_date",
];

const DEFAULT_SHARED_FIELDS: SharedFields = Object.fromEntries(
  SHARED_FIELDS_KEYS.map((k) => [k, true])
) as SharedFields;

/**
 * Wrapper que envia request ao Bling via fila + retry automático.
 * Retorna o Response. Se for 429 mesmo após retries, retorna o último Response 429.
 *
 * Use SEMPRE essa função em vez de fetch direto pra URLs do Bling.
 */
async function blingFetch(
  url: string,
  init: RequestInit,
  label: string
): Promise<Response> {
  return enqueueBlingRequest(async () => {
    const res = await fetch(url, init);
    // Se for 429, JOGA o erro pra fila detectar e retentar.
    // O rate-limiter vai reconhecer e fazer retry com backoff.
    if (res.status === 429) {
      // Importante: ler o body antes de jogar pra não vazar conexão
      const bodyText = await res.text().catch(() => "");
      const err = new Error(
        `Bling 429: ${bodyText.slice(0, 200) || "TOO_MANY_REQUESTS"}`
      );
      // Anexar status pro isRateLimitError detectar de qualquer forma
      (err as Error & { status?: number }).status = 429;
      throw err;
    }
    return res;
  }, label);
}

/** Extrai mensagem de erro da resposta da API Bling (vários formatos possíveis). */
function extractBlingErrorMessage(status: number, blingResponse: unknown): string {
  if (!blingResponse || typeof blingResponse !== "object") return `HTTP ${status}`;

  const r = blingResponse as Record<string, unknown>;

  // Formato: { error: { type, message, description, fields: [...] } }
  if (r.error && typeof r.error === "object") {
    const err = r.error as Record<string, unknown>;
    const parts: string[] = [];
    const desc =
      typeof err.description === "string" ? err.description :
      typeof err.message === "string" ? err.message : null;
    if (desc) parts.push(desc);

    // Campos com erro de validação
    if (Array.isArray(err.fields)) {
      err.fields.forEach((f) => {
        if (f && typeof f === "object") {
          const field = f as Record<string, unknown>;
          const fieldMsg = field.msg ?? field.message ?? field.descricao;
          const fieldName = field.campo ?? field.field ?? field.name;
          if (fieldMsg) parts.push(`${fieldName ? `${fieldName}: ` : ""}${fieldMsg}`);
        }
      });
    }
    if (parts.length) return parts.join(" | ");
  }

  // Formato: { errors: [{ message, descricao }] }
  if (Array.isArray(r.errors) && r.errors.length > 0) {
    const msgs = r.errors.map((e) => {
      if (e && typeof e === "object") {
        const err = e as Record<string, unknown>;
        return err.message ?? err.descricao ?? err.msg ?? JSON.stringify(err);
      }
      return String(e);
    });
    return msgs.filter(Boolean).join(" | ");
  }

  const msg =
    (typeof r.error === "string" && r.error) ||
    (typeof r.message === "string" && r.message);
  if (msg) return msg;

  return `HTTP ${status} — ${JSON.stringify(blingResponse).slice(0, 300)}`;
}

/** Normaliza shared_fields removendo campos obsoletos (ex: client_phone) e garantindo todos os atuais. */
export function normalizeSharedFields(raw: unknown): SharedFields {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, boolean>;
  return Object.fromEntries(
    SHARED_FIELDS_KEYS.map((k) => [k, obj[k] ?? DEFAULT_SHARED_FIELDS[k] ?? true])
  ) as SharedFields;
}

interface ClientData {
  id?: string;
  name?: string | null;
  company?: string | null;
  person_type?: "FISICA" | "JURIDICA" | null;
  document?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}

interface OrderItem {
  product_name?: string;
  quantity?: number;
  personalization?: unknown;
}

interface OrderData {
  due_date?: string | null;
  items?: OrderItem[];
}

/**
 * Monta o payload no formato da API Bling v3 (Contatos).
 * Ref: ContatosDadosBaseDTO + ContatosDadosDTO + ContatosEnderecoDTO
 */
export function buildBlingPayload(
  client: ClientData | null,
  order: OrderData,
  sharedFields: SharedFields
): { payload: Record<string, unknown>; fieldsSent: string[] } {
  const fieldsSent: string[] = [];

  // Detecta o tipo de pessoa: J (Jurídica) ou F (Física)
  const docDigits = client?.document ? String(client.document).replace(/\D/g, "") : "";
  const isJuridica =
    client?.person_type === "JURIDICA" || docDigits.length >= 14;
  const tipo = isJuridica ? "J" : "F";

  // Para PJ: name = razão social, company = nome fantasia
  // Para PF: name = nome completo
  const nomeRazaoSocial = String(client?.name ?? "").trim();
  const nomeFantasia = String(client?.company ?? "").trim();

  // nome (obrigatório no Bling): razão social para PJ, nome para PF
  const nomeEnvio = (isJuridica
    ? nomeRazaoSocial || nomeFantasia
    : nomeRazaoSocial || nomeFantasia
  ) || "Cliente";

  const payload: Record<string, unknown> = {
    nome: nomeEnvio,
    situacao: "A",
    tipo,
  };

  // fantasia: nome fantasia para PJ (quando diferente da razão social)
  if (isJuridica && nomeFantasia && nomeFantasia !== nomeRazaoSocial) {
    payload.fantasia = nomeFantasia;
  }

  if (sharedFields.client_name && (nomeRazaoSocial || nomeFantasia)) {
    fieldsSent.push("client_name");
  }

  if (sharedFields.client_document && docDigits) {
    payload.numeroDocumento = docDigits;
    fieldsSent.push("client_document");
  }

  const hasAddressFields =
    sharedFields.client_street ||
    sharedFields.client_number ||
    sharedFields.client_complement ||
    sharedFields.client_neighborhood ||
    sharedFields.client_city ||
    sharedFields.client_state ||
    sharedFields.client_zip_code;

  if (hasAddressFields && client) {
    const geral: Record<string, string> = {};
    if (sharedFields.client_street && client.street) {
      geral.endereco = client.street;
      fieldsSent.push("client_street");
    }
    if (sharedFields.client_number && client.number) {
      geral.numero = client.number;
      fieldsSent.push("client_number");
    }
    if (sharedFields.client_complement && client.complement) {
      geral.complemento = client.complement;
      fieldsSent.push("client_complement");
    }
    if (sharedFields.client_neighborhood && client.neighborhood) {
      geral.bairro = client.neighborhood;
      fieldsSent.push("client_neighborhood");
    }
    if (sharedFields.client_city && client.city) {
      geral.municipio = client.city;
      fieldsSent.push("client_city");
    }
    if (sharedFields.client_state && client.state) {
      geral.uf = client.state;
      fieldsSent.push("client_state");
    }
    if (sharedFields.client_zip_code && client.zip_code) {
      geral.cep = String(client.zip_code).replace(/\D/g, "");
      fieldsSent.push("client_zip_code");
    }
    if (Object.keys(geral).length > 0) {
      payload.endereco = { geral };
    }
  }

  // Dados do pedido ficam registrados no log (fieldsSent) mas não vão no payload do contato,
  // pois a API de Contatos do Bling v3 não aceita campos de pedido.
  if (sharedFields.order_products || sharedFields.order_quantities || sharedFields.order_personalization) {
    const items = order.items ?? [];
    if (items.length > 0) {
      items.forEach((item) => {
        if (sharedFields.order_products && item.product_name) fieldsSent.push("order_products");
        if (sharedFields.order_quantities && item.quantity != null) fieldsSent.push("order_quantities");
        if (sharedFields.order_personalization && item.personalization) fieldsSent.push("order_personalization");
      });
    }
  }
  if (sharedFields.order_due_date && order.due_date) {
    fieldsSent.push("order_due_date");
  }

  return { payload, fieldsSent };
}

type SupplierTokenFields = {
  bling_api_token?: string | null;
  bling_client_id?: string | null;
  bling_client_secret?: string | null;
  bling_access_token?: string | null;
  bling_refresh_token?: string | null;
  bling_token_expires_at?: string | null;
};

/**
 * Retorna um access token válido para o fornecedor.
 * Prioriza o token OAuth (access_token) com auto-refresh.
 * Faz fallback para o token manual legado (bling_api_token).
 */
async function getValidBlingToken(
  supplierId: string,
  supplier: SupplierTokenFields,
  db: SupabaseClient<Database>
): Promise<string | null> {
  const expiresAt = supplier.bling_token_expires_at
    ? new Date(supplier.bling_token_expires_at).getTime()
    : 0;
  const now = Date.now();
  const bufferMs = 60_000; // 1 minuto de margem

  // Token OAuth ainda válido
  if (supplier.bling_access_token && expiresAt > now + bufferMs) {
    return supplier.bling_access_token;
  }

  // Token expirado — tenta refresh
  if (
    supplier.bling_refresh_token &&
    supplier.bling_client_id &&
    supplier.bling_client_secret
  ) {
    const basicAuth = Buffer.from(
      `${supplier.bling_client_id}:${supplier.bling_client_secret}`
    ).toString("base64");

    try {
      const res = await blingFetch(
        "https://www.bling.com.br/Api/v3/oauth/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${basicAuth}`,
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: supplier.bling_refresh_token,
          }),
        },
        "oauth-refresh-token"
      );

      if (res.ok) {
        const data = await res.json();
        const newExpiresAt = new Date(
          Date.now() + (data.expires_in ?? 21600) * 1000
        ).toISOString();

        await db
          .from("suppliers")
          .update({
            bling_access_token: data.access_token,
            bling_refresh_token: data.refresh_token ?? supplier.bling_refresh_token,
            bling_token_expires_at: newExpiresAt,
          })
          .eq("id", supplierId);

        return data.access_token;
      }
    } catch {
      // continua para fallback
    }
  }

  // Fallback: token manual legado
  const legacy = (supplier.bling_api_token ?? "").trim();
  return legacy || null;
}

export async function testConnection(apiToken: string): Promise<{
  success: boolean;
  message?: string;
}> {
  const token = (apiToken ?? "").trim();
  const baseUrl = process.env.BLING_API_URL ?? "https://api.bling.com.br/Api/v3";
  try {
    const res = await blingFetch(
      `${baseUrl}/contatos?limite=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
      "test-connection"
    );

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        message: `Erro ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Erro de conexão",
    };
  }
}

export async function sendClientToBling(
  supplierId: string,
  orderId: string,
  sentBy?: string | null,
  supabaseClient?: SupabaseClient<Database>
): Promise<{
  success: boolean;
  blingContactId?: number;
  error?: string;
}> {
  const db = supabaseClient ?? supabase;

  const { data: supplier, error: supplierError } = await db
    .from("suppliers")
    .select("*")
    .eq("id", supplierId)
    .single();

  if (supplierError || !supplier) {
    return { success: false, error: "Fornecedor não encontrado." };
  }

  if (!supplier.is_active) {
    return { success: false, error: "Integração bloqueada — fornecedor inativo." };
  }

  const hasAgreement = await hasValidAgreement(supplierId, db);
  if (!hasAgreement) {
    return {
      success: false,
      error: "Integração bloqueada — termo não assinado.",
    };
  }

  const orderData = await getOrderById(orderId, db);
  if (!orderData) {
    return { success: false, error: "Pedido não encontrado." };
  }

  if (!orderData.client_id) {
    return { success: false, error: "Pedido sem cliente vinculado." };
  }

  const client = orderData.client as ClientData;
  const sharedFields = normalizeSharedFields(supplier.shared_fields);

  const { payload, fieldsSent } = buildBlingPayload(
    client,
    orderData as OrderData,
    sharedFields
  );

  const apiToken = await getValidBlingToken(supplierId, supplier, db);
  const baseUrl =
    (supplier.bling_base_url as string) ??
    process.env.BLING_API_URL ??
    "https://api.bling.com.br/Api/v3";

  if (!apiToken) {
    return {
      success: false,
      error: "Token Bling não configurado. Conecte o Bling em Configurações → Fornecedores.",
    };
  }

  try {
    const res = await blingFetch(
      `${baseUrl}/contatos`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      `send-client:${orderId}`
    );

    const blingResponse = await res.json().catch(() => ({}));
    const blingContactId =
      blingResponse?.data?.id ?? blingResponse?.id ?? null;

    const logStatus = res.ok ? "success" : "error";
    const errorMessage = !res.ok
      ? extractBlingErrorMessage(res.status, blingResponse)
      : null;

    await db.from("supplier_data_logs").insert({
      supplier_id: supplierId,
      order_id: orderId,
      client_id: orderData.client_id,
      data_sent: payload as never,
      fields_sent: fieldsSent,
      bling_contact_id: blingContactId,
      bling_response: blingResponse as never,
      status: logStatus,
      error_message: errorMessage,
      sent_by: sentBy ?? null,
    });

    if (!res.ok) {
      const baseMsg = errorMessage ? `Bling: ${errorMessage}` : "Erro ao enviar dados ao Bling.";
      const isInvalidToken =
        blingResponse &&
        typeof blingResponse === "object" &&
        (blingResponse as Record<string, unknown>).error &&
        typeof (blingResponse as Record<string, unknown>).error === "object" &&
        ((blingResponse as Record<string, unknown>).error as Record<string, unknown>).type === "invalid_token";
      const hint = isInvalidToken
        ? " Reconecte o Bling em Configurações → Fornecedores."
        : "";
      return {
        success: false,
        error: baseMsg + hint,
      };
    }

    return {
      success: true,
      blingContactId: blingContactId ?? undefined,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro de conexão";

    await db.from("supplier_data_logs").insert({
      supplier_id: supplierId,
      order_id: orderId,
      client_id: orderData.client_id,
      data_sent: payload as never,
      fields_sent: fieldsSent,
      bling_response: null,
      status: "error",
      error_message: errorMsg,
      sent_by: sentBy ?? null,
    });

    return { success: false, error: errorMsg };
  }
}

/**
 * Atualiza um contato existente no Bling (PUT /contatos/{id}).
 * Usa o mesmo payload de sendClientToBling.
 */
export async function updateBlingContact(
  supplierId: string,
  blingContactId: number,
  orderId: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<{ success: boolean; error?: string }> {
  const db = supabaseClient ?? supabase;

  const { data: supplier } = await db
    .from("suppliers")
    .select("*")
    .eq("id", supplierId)
    .single();

  if (!supplier) {
    return { success: false, error: "Fornecedor não encontrado" };
  }

  const orderData = await getOrderById(orderId, db);
  if (!orderData?.client) {
    return { success: false, error: "Pedido sem cliente vinculado" };
  }

  const client = orderData.client as ClientData;

  const hasMeaningfulData = !!(
    client.street || client.city || client.zip_code || client.document
  );
  if (!hasMeaningfulData) {
    console.log(
      `[bling] updateBlingContact pulado — cliente ${client.id} sem dados pra atualizar`
    );
    return { success: true };
  }

  const sharedFields = normalizeSharedFields(supplier.shared_fields);
  const { payload } = buildBlingPayload(client, orderData as OrderData, sharedFields);

  const apiToken = await getValidBlingToken(supplierId, supplier, db);
  const baseUrl =
    (supplier.bling_base_url as string) ??
    process.env.BLING_API_URL ??
    "https://api.bling.com.br/Api/v3";

  if (!apiToken) {
    return { success: false, error: "Token Bling não configurado" };
  }

  try {
    const res = await blingFetch(
      `${baseUrl}/contatos/${blingContactId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      `update-contact:${blingContactId}`
    );

    if (!res.ok) {
      const responseData = await res.json().catch(() => ({}));
      const errMsg = extractBlingErrorMessage(res.status, responseData);
      console.warn(
        `[bling] updateBlingContact falhou (${res.status}) pra contato ${blingContactId}: ${errMsg}`
      );
      return { success: false, error: errMsg };
    }

    console.log(`[bling] Contato ${blingContactId} atualizado com sucesso no Bling`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[bling] updateBlingContact erro: ${msg}`);
    return { success: false, error: msg };
  }
}

export async function getDataLogs(supplierId: string, page = 1, limit = 20) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from("supplier_data_logs")
    .select(
      "*, orders(id, order_number, title), clients(id, name)",
      { count: "exact" }
    )
    .eq("supplier_id", supplierId)
    .order("sent_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

// ════════════════════════════════════════════════
// VERIFICAR PEDIDO RECENTE DO MESMO CLIENTE NO BLING
// ════════════════════════════════════════════════

export async function checkRecentBlingOrder(
  supplierId: string,
  orderId: string,
  supabaseClient: SupabaseClient<Database>
): Promise<{
  hasDuplicate: boolean;
  recentOrders: {
    order_id: string;
    order_number: number | null;
    order_title: string;
    bling_order_id: number | null;
    sent_at: string;
    days_ago: number;
  }[];
}> {
  const db = supabaseClient ?? supabase;

  const { data: currentOrder } = await db
    .from("orders")
    .select("client_id")
    .eq("id", orderId)
    .single();

  if (!currentOrder?.client_id) {
    return { hasDuplicate: false, recentOrders: [] };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentLogs } = await db
    .from("supplier_data_logs")
    .select("order_id, sent_at")
    .eq("supplier_id", supplierId)
    .eq("client_id", currentOrder.client_id)
    .eq("status", "success")
    .contains("fields_sent", ["bling_order"])
    .gte("sent_at", thirtyDaysAgo.toISOString())
    .neq("order_id", orderId)
    .order("sent_at", { ascending: false });

  if (!recentLogs || recentLogs.length === 0) {
    return { hasDuplicate: false, recentOrders: [] };
  }

  const orderIds = [...new Set(recentLogs.map((l) => l.order_id))];
  const { data: orders } = await db
    .from("orders")
    .select("id, order_number, title, bling_order_id")
    .in("id", orderIds);

  const recentOrders = (orders ?? []).map((o) => {
    const log = recentLogs.find((l) => l.order_id === o.id);
    const sentDate = log ? new Date(log.sent_at) : new Date();
    const daysAgo = Math.floor(
      (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      order_id: o.id,
      order_number: o.order_number,
      order_title: o.title,
      bling_order_id: o.bling_order_id,
      sent_at: log?.sent_at ?? "",
      days_ago: daysAgo,
    };
  });

  return { hasDuplicate: true, recentOrders };
}

// ════════════════════════════════════════════════
// PEDIDO DE VENDA NO BLING
// ════════════════════════════════════════════════

/**
 * Gera variações do nome para busca no Bling.
 * Ex: "Siso odontologia ltda - ME" gera:
 *   1. "Siso odontologia ltda - ME" (original)
 *   2. "Siso odontologia ltda" (sem sufixo "- XXX")
 *   3. "Siso odontologia" (sem LTDA/EIRELI/SA/ME/EPP)
 *   4. "Siso" (primeira palavra, só se tiver 4+ caracteres)
 */
function generateNameVariations(name: string): string[] {
  const variations: string[] = [];
  const trimmed = name.trim();

  // 1. Nome original
  variations.push(trimmed);

  // 2. Sem sufixo após " - " (ex: "- ME", "- paloma", "- Dr João")
  const withoutDashSuffix = trimmed.replace(/\s*[-–]\s*[^-]+$/, "").trim();
  if (withoutDashSuffix !== trimmed && withoutDashSuffix.length >= 3) {
    variations.push(withoutDashSuffix);
  }

  // 3. Sem termos jurídicos (LTDA, EIRELI, SA, S/A, S.A., ME, EPP, etc.)
  const withoutLegal = withoutDashSuffix
    .replace(/\b(LTDA|EIRELI|SA|S\/A|S\.A\.|ME|EPP|EMPRESA|CIA|INC|UNIPESSOAL)\b\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (withoutLegal !== withoutDashSuffix && withoutLegal.length >= 3) {
    variations.push(withoutLegal);
  }

  // 4. Primeira(s) palavra(s) significativa(s) — mínimo 4 caracteres
  const words = withoutLegal.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length > 0 && words[0].length >= 4) {
    variations.push(words[0]);
  }

  // Remover duplicatas mantendo ordem
  return [...new Set(variations)];
}

/** Busca contato existente no Bling por nome, com múltiplas estratégias. */
async function findBlingContact(
  clientName: string,
  apiToken: string,
  baseUrl: string
): Promise<number | null> {
  const searchVariations = generateNameVariations(clientName);

  for (const searchTerm of searchVariations) {
    try {
      const searchUrl = `${baseUrl}/contatos?pesquisa=${encodeURIComponent(searchTerm)}&limite=5`;
      const res = await blingFetch(
        searchUrl,
        { headers: { Authorization: `Bearer ${apiToken}` } },
        `find-contact:${searchTerm}`
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { data?: { id?: number; nome?: string }[] };
      const contacts = data?.data ?? [];

      if (contacts.length > 0 && contacts[0].id != null) {
        return contacts[0].id;
      }
    } catch {
      continue;
    }
  }

  return null;
}

const blingProductCache = new Map<string, number | null>();

/** Fallback: mapeamento direto código SKU → ID numérico do produto no Bling.
 *  Usado quando a busca via API falha (rate limit, timeout, etc.) */
const BLING_PRODUCT_ID_MAP: Record<string, number> = {
  // ADDS Implant
  "PRD00011A": 16374933369, // ESCOVA ADDS IMPLANT EXTRA MACIA - AMARELA
  "PRD00011L": 16374933665, // ESCOVA ADDS IMPLANT EXTRA MACIA - LILAS
  "PRD00011V": 16374933877, // ESCOVA ADDS IMPLANT EXTRA MACIA - VERDE
  // ADDS Ultra
  "PRD00012A": 16615142495, // ESCOVA ADDS ULTRA 11400 - ULTRA MACIA - AZUL
  "PRD00012L": 16615143863, // ESCOVA ADDS ULTRA 11400 - ULTRA MACIA - LARANJA
  "PRD00012V": 16615143424, // ESCOVA ADDS ULTRA 11400 - ULTRA MACIA - VERMELHA
};

/** Mapeamento direto e-mail do usuário → ID do vendedor no Bling (fornecedor) */
const EMAIL_TO_BLING_VENDEDOR_ID: Record<string, number> = {
  "ana@adds.com.br": 15596870450,
  "maysa@adds.com.br": 15596870451,
  "helena@adds.com.br": 15596870453,
};

/** Primeiro nome (ou parte local do e-mail) → mesmo ID Bling, para quando o domínio mudou ou o pedido veio do Tiny */
const CANON_NAME_TO_BLING_VENDEDOR_ID: Record<string, number> = {
  ana: 15596870450,
  maysa: 15596870451,
  helena: 15596870453,
};

type BlingVendedorProfile = {
  full_name?: string | null;
  email?: string | null;
} | null;

function resolveBlingVendedorIdFromProfile(profile: BlingVendedorProfile): number | null {
  if (!profile) return null;

  const email =
    typeof profile.email === "string" && profile.email.trim()
      ? profile.email.toLowerCase().trim()
      : null;
  const fullName =
    typeof profile.full_name === "string" && profile.full_name.trim()
      ? profile.full_name
      : null;

  if (email) {
    const byFullEmail = EMAIL_TO_BLING_VENDEDOR_ID[email];
    if (byFullEmail) return byFullEmail;

    const at = email.indexOf("@");
    if (at > 0) {
      const local = email.slice(0, at);
      const byLocal = CANON_NAME_TO_BLING_VENDEDOR_ID[local];
      if (byLocal) return byLocal;
    }
  }

  if (fullName) {
    const first = fullName.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    const byFirst = CANON_NAME_TO_BLING_VENDEDOR_ID[first];
    if (byFirst) return byFirst;
  }

  return null;
}

/**
 * Vendedor no Bling: prioriza a responsável do pedido (pipeline), depois quem criou/importou.
 * Pedidos do Tiny muitas vezes têm `created_by` nulo ou sistema — `assigned_to` costuma ser a vendedora.
 */
function resolveBlingVendedorIdForOrder(
  assignedProfile: BlingVendedorProfile,
  createdByProfile: BlingVendedorProfile
): number | null {
  return (
    resolveBlingVendedorIdFromProfile(assignedProfile) ??
    resolveBlingVendedorIdFromProfile(createdByProfile)
  );
}

/**
 * Busca um produto no Bling pelo código (SKU) e retorna o ID numérico.
 * Usa cache em memória para evitar múltiplas chamadas na mesma execução.
 */
async function findBlingProductByCode(
  codigo: string,
  apiToken: string,
  baseUrl: string
): Promise<number | null> {
  const upperCodigo = codigo.toUpperCase().trim();

  if (blingProductCache.has(upperCodigo)) {
    return blingProductCache.get(upperCodigo) ?? null;
  }

  try {
    const url = `${baseUrl}/produtos?codigo=${encodeURIComponent(codigo)}&limite=1`;
    const res = await blingFetch(
      url,
      { headers: { Authorization: `Bearer ${apiToken}` } },
      `find-product:${codigo}`
    );

    if (!res.ok) {
      const fallbackId = BLING_PRODUCT_ID_MAP[upperCodigo];
      if (fallbackId && fallbackId > 0) {
        blingProductCache.set(upperCodigo, fallbackId);
        return fallbackId;
      }
      blingProductCache.set(upperCodigo, null);
      return null;
    }

    const data = (await res.json()) as { data?: { id?: number }[] };
    const products = data?.data ?? [];

    if (products.length > 0 && products[0].id != null) {
      const productId = products[0].id;
      blingProductCache.set(upperCodigo, productId);
      return productId;
    }

    const fallbackId = BLING_PRODUCT_ID_MAP[upperCodigo];
    if (fallbackId && fallbackId > 0) {
      blingProductCache.set(upperCodigo, fallbackId);
      return fallbackId;
    }

    blingProductCache.set(upperCodigo, null);
    return null;
  } catch (err) {
    const fallbackId = BLING_PRODUCT_ID_MAP[upperCodigo];
    if (fallbackId && fallbackId > 0) {
      blingProductCache.set(upperCodigo, fallbackId);
      return fallbackId;
    }
    blingProductCache.set(upperCodigo, null);
    return null;
  }
}

interface BlingOrderPayload {
  numero?: number;
  data: string;
  dataSaida: string;
  contato: { id: number };
  vendedor?: { id: number };
  itens: {
    produto?: { id: number };
    descricao?: string;
    quantidade: number;
    valor: number;
  }[];
  observacoes?: string;
  observacoesInternas?: string;
}

/** Resolve SKU do Bling a partir de product + cor. */
function resolveBlingSkuForItem(
  product: {
    bling_sku?: string | null;
    bling_color_sku_map?: Record<string, string> | null;
  } | null,
  colorKey: string | null
): string | null {
  console.log("[resolveSku] colorKey:", colorKey, "map:", JSON.stringify(product?.bling_color_sku_map));
  if (!product) return null;

  // 1. Se tem cor e tem mapeamento de cor → usar SKU da cor
  if (colorKey && product.bling_color_sku_map) {
    const exactMatch = product.bling_color_sku_map[colorKey.toLowerCase()];
    if (exactMatch) return exactMatch;

    // Tentar match parcial (ex: "amarelo" vs "amarela")
    const normalizedKey = colorKey.toLowerCase().replace(/[oa]$/, "");
    for (const [mapKey, sku] of Object.entries(product.bling_color_sku_map)) {
      const normalizedMapKey = mapKey.toLowerCase().replace(/[oa]$/, "");
      if (normalizedMapKey === normalizedKey) return sku;
    }
  }

  // 2. Se tem SKU base (produto sem variação de cor) → usar direto
  if (product.bling_sku) return product.bling_sku;

  return null;
}

/** Extrai o objeto pedido da resposta GET /pedidos/:id (Tiny V3). */
function unwrapTinyPedidoFromApiResponse(apiResponse: unknown): Record<string, unknown> | null {
  if (!apiResponse || typeof apiResponse !== "object") return null;
  const r = apiResponse as Record<string, unknown>;
  const data = r.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (d.pedido && typeof d.pedido === "object") {
      return d.pedido as Record<string, unknown>;
    }
    if ("id" in d) return d as Record<string, unknown>;
  }
  if (r.pedido && typeof r.pedido === "object") {
    return r.pedido as Record<string, unknown>;
  }
  if ("id" in r) return r as Record<string, unknown>;
  return null;
}

function normalizeTinyApiLineItems(rawItens: unknown): Array<{
  sku: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}> {
  if (!Array.isArray(rawItens)) return [];
  const out: Array<{
    sku: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
  }> = [];
  for (const row of rawItens) {
    const line =
      row && typeof row === "object" && "item" in (row as object)
        ? (row as { item?: unknown }).item
        : row;
    if (!line || typeof line !== "object") continue;
    const l = line as Record<string, unknown>;
    let prodRaw: unknown = l.produto;
    if (prodRaw && typeof prodRaw === "object" && "produto" in (prodRaw as object)) {
      prodRaw = (prodRaw as { produto?: unknown }).produto;
    }
    const p =
      prodRaw && typeof prodRaw === "object"
        ? (prodRaw as Record<string, unknown>)
        : {};
    const sku =
      typeof p.sku === "string" ? p.sku : p.codigo != null ? String(p.codigo) : "";
    const descricao =
      typeof p.descricao === "string"
        ? p.descricao
        : typeof p.nome === "string"
          ? p.nome
          : "Item do pedido";
    const q = Number(l.quantidade ?? 0);
    const vu = Number(
      l.valorUnitario ?? l.valor_unitario ?? l.valorUnitarioPedido ?? 0
    );
    out.push({
      sku: sku.trim(),
      descricao,
      quantidade: Number.isFinite(q) ? q : 0,
      valorUnitario: Number.isFinite(vu) ? vu : 0.01,
    });
  }
  return out;
}

/** Monta o payload do Pedido de Venda Bling. */
async function buildBlingOrderPayload(
  orderId: string,
  blingContactId: number,
  apiToken: string,
  baseUrl: string,
  db: SupabaseClient<Database>,
  onlyMappedProducts = false
): Promise<BlingOrderPayload> {
  const { data: order, error: orderError } = await db
    .from("orders")
    .select(
      `
      *,
      client:clients(*),
      created_by_profile:profiles!orders_created_by_fkey(full_name, email),
      assigned_to_profile:profiles!orders_assigned_to_fkey(full_name, email),
      items:order_items(
        *,
        product:products(id, name, bling_sku, bling_color_sku_map, tiny_color_map)
      )
    `
    )
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error(`Pedido não encontrado: ${orderId}`);
  }

  const itens: BlingOrderPayload["itens"] = [];
  const unmappedItems: string[] = [];

  for (const item of order.items ?? []) {
    const personalization = item.personalization as
      | { colors?: string[]; custom_color?: string | null; notes?: string }
      | null;
    const colorKey = personalization?.colors?.[0] ?? item.color ?? null;
    const colorLabel =
      colorKey === "custom"
        ? personalization?.custom_color ?? "Personalizada"
        : item.color_name ?? colorKey;

    const product = item.product as
      | { bling_sku?: string | null; bling_color_sku_map?: Record<string, string> | null }
      | null;
    const blingSku = resolveBlingSkuForItem(product, colorKey);

    const descricao = formatProductWithColor({
      product_name: item.product_name,
      color_name: colorLabel,
    });

    if (blingSku) {
      const blingProductId = await findBlingProductByCode(blingSku, apiToken, baseUrl);

      if (blingProductId) {
        itens.push({
          produto: { id: blingProductId },
          quantidade: item.quantity,
          valor: 0.01,
        });
      } else {
        itens.push({
          descricao,
          quantidade: item.quantity,
          valor: 0.01,
        } as BlingOrderPayload["itens"][number]);
        unmappedItems.push(
          `${descricao} x${item.quantity} [SKU: ${blingSku} não encontrado no Bling]`
        );
      }
    } else {
      unmappedItems.push(`${descricao} x${item.quantity}`);
    }
  }

  // === ITENS EXTRAS DO TINY (não-personalizados) ===
  // Se onlyMappedProducts=true, pula completamente — apenas produtos com SKU Bling mapeado são enviados.
  // Caso contrário, busca itens do Tiny que não foram incluídos pelos SKUs Bling.
  const tinyOrderId = order.tiny_order_id;
  if (tinyOrderId && !onlyMappedProducts) {
    try {
      const { tinyApiGet } = await import("@/lib/tiny-api");
      const tinyResponse = await tinyApiGet(`/pedidos/${tinyOrderId}`);
      const tinyPedido = unwrapTinyPedidoFromApiResponse(tinyResponse);
      const tinyItems = normalizeTinyApiLineItems(tinyPedido?.itens);

      // Conjunto de SKUs já adicionados: Bling SKUs + Tiny SKUs (via tiny_color_map)
      const addedSkus = new Set<string>();
      for (const item of order.items ?? []) {
        const product = item.product as {
          bling_sku?: string | null;
          bling_color_sku_map?: Record<string, string> | null;
          tiny_color_map?: Record<string, { sku?: string; tiny_id?: number | string } | null> | null;
        } | null;

        if (product?.bling_sku) {
          addedSkus.add(product.bling_sku.toUpperCase().trim());
        }
        if (product?.bling_color_sku_map && typeof product.bling_color_sku_map === "object") {
          for (const sku of Object.values(product.bling_color_sku_map)) {
            if (typeof sku === "string") addedSkus.add(sku.toUpperCase().trim());
          }
        }
        // Inclui SKUs do Tiny para evitar duplicatas quando o mesmo item vem do Tiny com SKU diferente
        if (product?.tiny_color_map && typeof product.tiny_color_map === "object") {
          for (const variation of Object.values(product.tiny_color_map)) {
            if (variation && typeof variation === "object" && typeof variation.sku === "string") {
              addedSkus.add(variation.sku.toUpperCase().trim());
            }
          }
        }
      }

      console.info(`[bling] SKUs já mapeados (deduplicação): ${[...addedSkus].join(", ")}`);

      const extraTinyItems = tinyItems.filter((ti) => {
        const sku = ti.sku.toUpperCase().trim();
        return sku.length > 0 && !addedSkus.has(sku);
      });

      if (extraTinyItems.length > 0) {
        console.info(`[bling] ${extraTinyItems.length} item(ns) extra(s) do Tiny (não mapeados no CRM): ${extraTinyItems.map((i) => i.sku).join(", ")}`);
      }

      for (const tinyItem of extraTinyItems) {
        const sku = tinyItem.sku;
        const descricao = tinyItem.descricao || "Item do pedido";
        const quantidade = tinyItem.quantidade > 0 ? tinyItem.quantidade : 1;

        const blingProductId = await findBlingProductByCode(sku, apiToken, baseUrl);
        if (blingProductId) {
          itens.push({
            produto: { id: blingProductId },
            quantidade,
            valor: 0.01,
          });
        } else {
          itens.push({
            descricao: `${descricao} (${sku})`,
            quantidade,
            valor: 0.01,
          } as BlingOrderPayload["itens"][number]);
          unmappedItems.push(
            `${descricao} x${quantidade} [SKU Tiny: ${sku} — não encontrado no Bling]`
          );
        }
      }
    } catch (err) {
      console.warn(
        `[bling] Falha ao buscar itens extras do Tiny (tiny_order_id=${tinyOrderId}):`,
        err instanceof Error ? err.message : err
      );
    }
  } else if (onlyMappedProducts) {
    console.info(`[bling] only_mapped_products=true — itens extras do Tiny ignorados`);
  }

  const obsLines: string[] = [];

  // Personalização do pedido (enviar exatamente como está, sem modificar)
  if (order.description) {
    obsLines.push(order.description);
  }

  // Personalização individual dos itens
  for (const item of order.items ?? []) {
    const pers = item.personalization as { notes?: string } | null;
    if (pers?.notes) {
      obsLines.push(`${item.product_name}: ${pers.notes}`);
    }
  }

  // Itens sem código Bling (manter — é útil para o fornecedor)
  if (unmappedItems.length > 0) {
    obsLines.push("");
    obsLines.push("Itens sem código Bling (verificar manualmente):");
    unmappedItems.forEach((line) => obsLines.push(`- ${line}`));
  }

  // NÃO incluir dados do cliente (nome, telefone, cidade, estado)
  // O cliente já está vinculado ao pedido como contato no Bling

  const today = new Date().toISOString().split("T")[0];
  const createdByProfile = order.created_by_profile as BlingVendedorProfile;
  const assignedToProfile = order.assigned_to_profile as BlingVendedorProfile;
  const vendedorId = resolveBlingVendedorIdForOrder(assignedToProfile, createdByProfile);
  const vendedorCrmName =
    assignedToProfile?.full_name?.trim() ||
    createdByProfile?.full_name?.trim() ||
    "Sistema";

  if (vendedorId) {
    console.info(
      `[bling] vendedor Bling ${vendedorId} (CRM: ${vendedorCrmName} — atribuição: assigned=${!!assignedToProfile?.email} created=${!!createdByProfile?.email})`
    );
  } else {
    console.info(
      `[bling] nenhum vendedor Bling mapeado (assigned=${assignedToProfile?.email ?? "—"} created=${createdByProfile?.email ?? "—"})`
    );
  }

  const payload: BlingOrderPayload = {
    data: today,
    dataSaida: today,
    contato: { id: blingContactId },
    ...(vendedorId ? { vendedor: { id: vendedorId } } : {}),
    itens,
    observacoes: obsLines.length > 0 ? obsLines.join("\n") : undefined,
    observacoesInternas: `Pedido CRM #${order.order_number ?? ""} | Vendedor CRM: ${vendedorCrmName}`,
  };

  return payload;
}

/** Cria Pedido de Venda no Bling. */
export async function createBlingOrder(
  supplierId: string,
  orderId: string,
  userId: string | null,
  supabaseClient: SupabaseClient<Database>
): Promise<{ blingOrderId: number; blingOrderNumber: number }> {
  const db = supabaseClient ?? supabase;

  const { data: supplier, error: supplierError } = await db
    .from("suppliers")
    .select("*")
    .eq("id", supplierId)
    .single();

  if (supplierError || !supplier) {
    throw new Error("Fornecedor não encontrado");
  }

  if (!supplier.is_active) {
    throw new Error("Integração bloqueada — fornecedor inativo.");
  }

  const hasAgreement = await hasValidAgreement(supplierId, db);
  if (!hasAgreement) {
    throw new Error("Integração bloqueada — termo não assinado.");
  }

  const orderData = await getOrderById(orderId, db);
  if (!orderData) {
    throw new Error("Pedido não encontrado.");
  }
  if (!orderData.client_id) {
    throw new Error("Pedido sem cliente vinculado.");
  }

  const apiToken = await getValidBlingToken(supplierId, supplier, db);
  const baseUrl =
    (supplier.bling_base_url as string) ??
    process.env.BLING_API_URL ??
    "https://api.bling.com.br/Api/v3";

  if (!apiToken) {
    throw new Error("Token do Bling não configurado");
  }

  blingProductCache.clear();

  // Parte 1: Buscar bling_contact_id em logs — por order_id OU por client_id
  const { data: lastLogByOrder } = await db
    .from("supplier_data_logs")
    .select("bling_contact_id")
    .eq("supplier_id", supplierId)
    .eq("order_id", orderId)
    .eq("status", "success")
    .not("bling_contact_id", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let blingContactId = lastLogByOrder?.bling_contact_id as number | null;

  if (!blingContactId && orderData.client_id) {
    // Buscar em QUALQUER log de sucesso deste cliente (não só deste pedido)
    const { data: lastLogByClient } = await db
      .from("supplier_data_logs")
      .select("bling_contact_id")
      .eq("supplier_id", supplierId)
      .eq("client_id", orderData.client_id)
      .eq("status", "success")
      .not("bling_contact_id", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    blingContactId = lastLogByClient?.bling_contact_id as number | null;
  }

  if (!blingContactId) {
    const contactResult = await sendClientToBling(
      supplierId,
      orderId,
      userId,
      db
    );

    if (contactResult.success && contactResult.blingContactId) {
      blingContactId = contactResult.blingContactId;
    } else {
      const { data: newLog } = await db
        .from("supplier_data_logs")
        .select("bling_contact_id")
        .eq("supplier_id", supplierId)
        .eq("order_id", orderId)
        .eq("status", "success")
        .not("bling_contact_id", "is", null)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      blingContactId = newLog?.bling_contact_id as number | null;
    }
  }

  if (!blingContactId) {
    // Parte 3: Fallback — buscar contato existente no Bling por nome
    const client = orderData.client as { name?: string } | null;
    const clientName = client?.name;

    if (clientName) {
      blingContactId = await findBlingContact(clientName, apiToken, baseUrl);
    }
  }

  if (!blingContactId) {
    throw new Error("Não foi possível encontrar ou criar o contato no Bling");
  }

  await updateBlingContact(supplierId, blingContactId, orderId, db).catch((err) => {
    console.warn("[bling] updateBlingContact catch externo:", err);
  });

  const clientId = orderData.client_id;

  const onlyMappedProducts = !!(supplier as { only_mapped_products?: boolean }).only_mapped_products;
  console.info(`[bling] createBlingOrder: only_mapped_products=${onlyMappedProducts}`);

  const payload = await buildBlingOrderPayload(
    orderId,
    blingContactId,
    apiToken,
    baseUrl,
    db,
    onlyMappedProducts
  );

  if (payload.itens.length === 0) {
    throw new Error(
      "Nenhum item do pedido possui mapeamento de SKU do Bling. Configure bling_sku ou bling_color_sku_map nos produtos."
    );
  }

  const res = await blingFetch(
    `${baseUrl}/pedidos/vendas`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(payload),
    },
    `create-order:${orderId}`
  );

  const responseData = (await res.json().catch(() => ({}))) as {
    data?: { id?: number; numero?: number };
    error?: unknown;
  };

  if (!res.ok) {
    // Pedido NÃO foi criado — gravar log com fields_sent=[] (não mente que enviou)
    // Isso faz a UI exibir tag "Parcial" (amarela) em vez de "Erro Bling" (vermelha)
    // quando o contato foi enviado mas o pedido falhou.
    const errMsg = extractBlingErrorMessage(res.status, responseData);
    await db.from("supplier_data_logs").insert({
      supplier_id: supplierId,
      order_id: orderId,
      client_id: clientId,
      data_sent: payload as never,
      fields_sent: [],
      status: "error",
      error_message: errMsg,
      sent_by: userId,
    });
    throw new Error(`Bling API error ${res.status}: ${errMsg}`);
  }

  const blingOrderId = responseData?.data?.id;
  const blingOrderNumber = responseData?.data?.numero ?? blingOrderId;

  if (blingOrderId == null) {
    throw new Error("Bling não retornou ID do pedido criado");
  }

  await db.from("supplier_data_logs").insert({
    supplier_id: supplierId,
    order_id: orderId,
    client_id: clientId,
    data_sent: payload as never,
    fields_sent: ["bling_order", "bling_order_items"],
    bling_contact_id: blingContactId,
    status: "success",
    bling_response: responseData as never,
    sent_by: userId,
  });

  await db
    .from("orders")
    .update({
      bling_order_id: blingOrderId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  return {
    blingOrderId,
    blingOrderNumber: blingOrderNumber ?? blingOrderId,
  };
}

/** Envia contato + pedido de venda ao Bling. */
export async function sendOrderToBling(
  supplierId: string,
  orderId: string,
  userId: string | null,
  supabaseClient?: SupabaseClient<Database>
): Promise<{
  contactSent: boolean;
  orderSent: boolean;
  blingOrderId?: number;
  blingOrderNumber?: number;
  error?: string;
}> {
  const db = supabaseClient ?? supabase;
  const result = {
    contactSent: false,
    orderSent: false,
    blingOrderId: undefined as number | undefined,
    blingOrderNumber: undefined as number | undefined,
    error: undefined as string | undefined,
  };

  const orderDataCheck = await getOrderById(orderId, db);
  const clientCheck = orderDataCheck?.client as ClientData | null;
  const hasAddress = !!(
    clientCheck?.street &&
    clientCheck?.city &&
    clientCheck?.zip_code
  );

  if (!hasAddress) {
    console.warn(
      `[bling] Order ${orderId} sendo enviado SEM endereço completo do cliente. ` +
        `Cliente: ${clientCheck?.name ?? "?"} (${clientCheck?.id ?? "?"}). ` +
        `Bling vai aceitar mas com aviso amarelo de pendência cadastral.`
    );
  }

  const contactResult = await sendClientToBling(supplierId, orderId, userId, db);
  if (contactResult.success) {
    result.contactSent = true;
  } else {
    const msg = contactResult.error ?? "";
    if (msg.includes("já está cadastrado") || msg.includes("já cadastrado")) {
      result.contactSent = true;
    } else {
      result.error = `Erro ao enviar contato: ${msg}`;
    }
  }

  await new Promise((r) => setTimeout(r, 500));

  try {
    const orderResult = await createBlingOrder(supplierId, orderId, userId, db);
    result.orderSent = true;
    result.blingOrderId = orderResult.blingOrderId;
    result.blingOrderNumber = orderResult.blingOrderNumber;
  } catch (e) {
    const orderError = `Erro ao criar pedido: ${e instanceof Error ? e.message : String(e)}`;
    result.error = result.error ? `${result.error} | ${orderError}` : orderError;
  }

  return result;
}

// ════════════════════════════════════════════════
// DADOS DO BLING (vendedores e produtos)
// ════════════════════════════════════════════════

export type BlingVendedorItem = {
  id?: number;
  codigo?: number | string;
  nome?: string;
  email?: string;
};

export type BlingProdutoItem = {
  id?: number;
  codigo?: string;
  nome?: string;
};

export type BlingDataResult = {
  success: boolean;
  vendedores: BlingVendedorItem[];
  produtos: BlingProdutoItem[];
  error?: string;
};

/**
 * Busca vendedores e produtos cadastrados no Bling.
 * Usado para validar integração e mapeamentos (ex.: aba "Dados Bling" no fornecedor).
 */
export async function fetchBlingData(
  supplierId: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<BlingDataResult> {
  const db = supabaseClient ?? supabase;

  const { data: supplier, error: supplierError } = await db
    .from("suppliers")
    .select("*")
    .eq("id", supplierId)
    .single();

  if (supplierError || !supplier) {
    return { success: false, vendedores: [], produtos: [], error: "Fornecedor não encontrado." };
  }

  const apiToken = await getValidBlingToken(supplierId, supplier, db);
  const baseUrl =
    (supplier.bling_base_url as string) ??
    process.env.BLING_API_URL ??
    "https://api.bling.com.br/Api/v3";

  if (!apiToken) {
    return {
      success: false,
      vendedores: [],
      produtos: [],
      error: "Token Bling não configurado. Conecte o Bling em Editar fornecedor.",
    };
  }

  const headers = { Authorization: `Bearer ${apiToken}` };
  const result: BlingDataResult = { success: true, vendedores: [], produtos: [] };

  try {
    // Vendedores: GET /vendedores
    const vendedoresRes = await blingFetch(
      `${baseUrl}/vendedores?limite=100`,
      { headers },
      "fetch-vendedores"
    );
    if (vendedoresRes.ok) {
      const vData = (await vendedoresRes.json()) as { data?: unknown[] | { data?: unknown[] } };
      const raw = Array.isArray(vData?.data)
        ? vData.data
        : Array.isArray((vData?.data as { data?: unknown[] })?.data)
          ? (vData.data as { data: unknown[] }).data
          : [];
      result.vendedores = raw.map((v) => {
        const item = v as Record<string, unknown>;
        const contato = item?.contato as Record<string, unknown> | undefined;
        return {
          id: (item.id ?? contato?.id) as number | undefined,
          codigo: (item.codigo ?? item.id ?? contato?.id) as number | string | undefined,
          nome: (contato?.nome ?? item.nome) as string | undefined,
          email: (contato?.email ?? item.email) as string | undefined,
        } satisfies BlingVendedorItem;
      });
    } else if (!result.error) {
      result.error = `Erro vendedores: ${(await vendedoresRes.text()).slice(0, 80)}`;
    }

    // Produtos: paginar (criterio=5 = Todos) + variações (tipo=V)
    const allProdutos: BlingProdutoItem[] = [];
    let pagina = 1;
    const limite = 100;
    let hasMore = true;

    while (hasMore) {
      const produtosRes = await blingFetch(
        `${baseUrl}/produtos?limite=${limite}&pagina=${pagina}&criterio=5`,
        { headers },
        `fetch-produtos-page-${pagina}`
      );
      if (!produtosRes.ok) {
        result.error = result.error
          ? `${result.error} | Erro produtos: ${(await produtosRes.text()).slice(0, 80)}`
          : `Erro ao buscar produtos: ${(await produtosRes.text()).slice(0, 80)}`;
        break;
      }
      const pData = (await produtosRes.json()) as { data?: unknown[] | { data?: unknown[] } };
      const raw = Array.isArray(pData?.data)
        ? pData.data
        : Array.isArray((pData?.data as { data?: unknown[] })?.data)
          ? (pData.data as { data: unknown[] }).data
          : [];

      // Normaliza: API pode retornar { id, codigo, nome } ou { id, produto: { codigo, nome } }
      // Também extrai variações aninhadas (variacoes: [{ id, codigo, nome }])
      for (const p of raw) {
        const item = p as Record<string, unknown>;
        const variacoes = item?.variacoes as Array<Record<string, unknown>> | undefined;
        const pushItem = (obj: Record<string, unknown>) => {
          const nested = obj?.produto as Record<string, unknown> | undefined;
          allProdutos.push({
            id: (obj.id ?? nested?.id) as number | undefined,
            codigo: (obj.codigo ?? nested?.codigo) as string | undefined,
            nome: (obj.nome ?? nested?.nome) as string | undefined,
          });
        };
        pushItem(item);
        if (Array.isArray(variacoes)) {
          for (const v of variacoes) {
            if (v && typeof v === "object") pushItem(v as Record<string, unknown>);
          }
        }
      }

      hasMore = raw.length >= limite;
      pagina++;
      if (pagina > 50) break; // segurança: máximo ~5000 produtos
    }

    // Variações (tipo=V): PRD00012A, PRD00012L etc podem vir só aqui
    const seenIds = new Set(allProdutos.map((p) => p.id).filter(Boolean));
    let paginaV = 1;
    let hasMoreV = true;
    while (hasMoreV) {
      const varRes = await blingFetch(
        `${baseUrl}/produtos?limite=${limite}&pagina=${paginaV}&criterio=5&tipo=V`,
        { headers },
        `fetch-variacoes-page-${paginaV}`
      );
      if (!varRes.ok) break;
      const vData = (await varRes.json()) as { data?: unknown[] | { data?: unknown[] } };
      const vRaw = Array.isArray(vData?.data)
        ? vData.data
        : Array.isArray((vData?.data as { data?: unknown[] })?.data)
          ? (vData.data as { data: unknown[] }).data
          : [];
      for (const p of vRaw) {
        const item = p as Record<string, unknown>;
        const produto = item?.produto as Record<string, unknown> | undefined;
        const id = (item.id ?? produto?.id) as number | undefined;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          allProdutos.push({
            id,
            codigo: (item.codigo ?? produto?.codigo) as string | undefined,
            nome: (item.nome ?? produto?.nome) as string | undefined,
          });
        }
      }
      hasMoreV = vRaw.length >= limite;
      paginaV++;
      if (paginaV > 50) break;
    }

    result.produtos = allProdutos;

    return result;
  } catch (e) {
    return {
      success: false,
      vendedores: [],
      produtos: [],
      error: e instanceof Error ? e.message : "Erro de conexão",
    };
  }
}
