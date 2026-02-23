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
