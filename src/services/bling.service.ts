import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { getOrderById } from "./orders.service";
import { hasValidAgreement } from "./agreements.service";

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
      const res = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: supplier.bling_refresh_token,
        }),
      });

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
    const res = await fetch(`${baseUrl}/contatos?limite=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

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
    const res = await fetch(`${baseUrl}/contatos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

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
      const res = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
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

interface BlingOrderPayload {
  numero?: number;
  data: string;
  dataSaida: string;
  contato: { id: number };
  vendedor?: { id: number };
  itens: {
    produto: {
      id?: number;
      codigo?: string;
    };
    quantidade: number;
    valor: number;
    descricao?: string;
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

/** Monta o payload do Pedido de Venda Bling. */
async function buildBlingOrderPayload(
  orderId: string,
  blingContactId: number,
  db: SupabaseClient<Database>
): Promise<BlingOrderPayload> {
  const { data: order, error: orderError } = await db
    .from("orders")
    .select(
      `
      *,
      client:clients(*),
      created_by_profile:profiles!orders_created_by_fkey(full_name),
      items:order_items(
        *,
        product:products(id, name, bling_sku, bling_color_sku_map)
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
    const colorKey = personalization?.colors?.[0] ?? null;
    const colorLabel =
      colorKey === "custom"
        ? personalization?.custom_color ?? "Personalizada"
        : colorKey;

    const product = item.product as
      | { bling_sku?: string | null; bling_color_sku_map?: Record<string, string> | null }
      | null;
    const blingSku = resolveBlingSkuForItem(product, colorKey);

    if (blingSku) {
      itens.push({
        produto: {
          codigo: blingSku,
        },
        quantidade: item.quantity,
        valor: 0.01,
        descricao: colorLabel
          ? `${item.product_name} - ${colorLabel}`
          : item.product_name,
      });
    } else {
      unmappedItems.push(
        `${item.product_name}${colorLabel ? ` (${colorLabel})` : ""} x${item.quantity}`
      );
    }
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
  const createdByProfile = order.created_by_profile as { full_name?: string } | null;

  const payload: BlingOrderPayload = {
    data: today,
    dataSaida: today,
    contato: { id: blingContactId },
    itens,
    observacoes: obsLines.length > 0 ? obsLines.join("\n") : undefined,
    observacoesInternas: `Pedido CRM #${order.order_number ?? ""} | Criado por: ${createdByProfile?.full_name ?? "Sistema"}`,
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

  const clientId = orderData.client_id;

  const payload = await buildBlingOrderPayload(orderId, blingContactId, db);

  if (payload.itens.length === 0) {
    throw new Error(
      "Nenhum item do pedido possui mapeamento de SKU do Bling. Configure bling_sku ou bling_color_sku_map nos produtos."
    );
  }

  const res = await fetch(`${baseUrl}/pedidos/vendas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(payload),
  });

  const responseData = (await res.json().catch(() => ({}))) as {
    data?: { id?: number; numero?: number };
    error?: unknown;
  };

  if (!res.ok) {
    await db.from("supplier_data_logs").insert({
      supplier_id: supplierId,
      order_id: orderId,
      client_id: clientId,
      data_sent: payload as never,
      fields_sent: ["bling_order"],
      status: "error",
      error_message: JSON.stringify(responseData),
      sent_by: userId,
    });
    throw new Error(
      `Bling API error ${res.status}: ${JSON.stringify(responseData?.error ?? responseData)}`
    );
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

  try {
    await sendClientToBling(supplierId, orderId, userId, db);
    result.contactSent = true;
  } catch (e) {
    result.error = `Erro ao enviar contato: ${e instanceof Error ? e.message : String(e)}`;
  }

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
