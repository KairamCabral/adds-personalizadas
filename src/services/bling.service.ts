import { createClient } from "@/lib/supabase/client";
import { getOrderById } from "./orders.service";
import { hasValidAgreement } from "./agreements.service";

const supabase = createClient();

export type SharedFields = Record<
  | "client_name"
  | "client_phone"
  | "client_city"
  | "client_state"
  | "client_zip_code"
  | "order_products"
  | "order_quantities"
  | "order_personalization"
  | "order_due_date",
  boolean
>;

interface ClientData {
  id?: string;
  name?: string | null;
  phone?: string | null;
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

export function buildBlingPayload(
  client: ClientData | null,
  order: OrderData,
  sharedFields: SharedFields
): { payload: Record<string, unknown>; fieldsSent: string[] } {
  const fieldsSent: string[] = [];
  const payload: Record<string, unknown> = {
    tipo: "F",
  };

  if (!client && !order) {
    return { payload, fieldsSent };
  }

  if (sharedFields.client_name && client?.name) {
    payload.nome = client.name;
    fieldsSent.push("client_name");
  }

  if (sharedFields.client_phone && client?.phone) {
    payload.telefone = client.phone;
    fieldsSent.push("client_phone");
  }

  if (
    sharedFields.client_city ||
    sharedFields.client_state ||
    sharedFields.client_zip_code
  ) {
    payload.endereco = payload.endereco ?? {};
    const endereco = payload.endereco as Record<string, string>;

    if (sharedFields.client_city && client?.city) {
      endereco.municipio = client.city;
      fieldsSent.push("client_city");
    }
    if (sharedFields.client_state && client?.state) {
      endereco.uf = client.state;
      fieldsSent.push("client_state");
    }
    if (sharedFields.client_zip_code && client?.zip_code) {
      endereco.cep = client.zip_code;
      fieldsSent.push("client_zip_code");
    }
  }

  if (
    sharedFields.order_products ||
    sharedFields.order_quantities ||
    sharedFields.order_personalization
  ) {
    const items = order.items ?? [];
    if (items.length > 0) {
      const produtos: string[] = [];
      const quantidades: number[] = [];
      const personalizacoes: unknown[] = [];

      items.forEach((item) => {
        if (sharedFields.order_products && item.product_name) {
          produtos.push(item.product_name);
        }
        if (sharedFields.order_quantities && item.quantity != null) {
          quantidades.push(item.quantity);
        }
        if (sharedFields.order_personalization && item.personalization) {
          personalizacoes.push(item.personalization);
        }
      });

      if (produtos.length > 0) {
        payload.produtos = produtos;
        fieldsSent.push("order_products");
      }
      if (quantidades.length > 0) {
        payload.quantidades = quantidades;
        fieldsSent.push("order_quantities");
      }
      if (personalizacoes.length > 0) {
        payload.personalizacao = personalizacoes;
        fieldsSent.push("order_personalization");
      }
    }
  }

  if (sharedFields.order_due_date && order.due_date) {
    payload.prazo_entrega = order.due_date;
    fieldsSent.push("order_due_date");
  }

  return { payload, fieldsSent };
}

export async function testConnection(apiToken: string): Promise<{
  success: boolean;
  message?: string;
}> {
  const baseUrl = process.env.BLING_API_URL ?? "https://api.bling.com.br/Api/v3";
  try {
    const res = await fetch(`${baseUrl}/contatos?limite=1`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
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
  sentBy?: string | null
): Promise<{
  success: boolean;
  blingContactId?: number;
  error?: string;
}> {
  const { data: supplier, error: supplierError } = await supabase
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

  const hasAgreement = await hasValidAgreement(supplierId);
  if (!hasAgreement) {
    return {
      success: false,
      error: "Integração bloqueada — termo não assinado.",
    };
  }

  const orderData = await getOrderById(orderId);
  if (!orderData) {
    return { success: false, error: "Pedido não encontrado." };
  }

  if (!orderData.client_id) {
    return { success: false, error: "Pedido sem cliente vinculado." };
  }

  const client = orderData.client as ClientData;
  const sharedFields = (supplier.shared_fields ?? {}) as SharedFields;

  const { payload, fieldsSent } = buildBlingPayload(
    client,
    orderData as OrderData,
    sharedFields
  );

  const apiToken = supplier.bling_api_token;
  const baseUrl =
    (supplier.bling_base_url as string) ??
    process.env.BLING_API_URL ??
    "https://api.bling.com.br/Api/v3";

  if (!apiToken) {
    return { success: false, error: "Token Bling não configurado." };
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
      ? (blingResponse?.error ?? blingResponse?.message ?? `HTTP ${res.status}`)
      : null;

    await supabase.from("supplier_data_logs").insert({
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
      return {
        success: false,
        error:
          typeof errorMessage === "string"
            ? errorMessage
            : "Erro ao enviar dados ao Bling.",
      };
    }

    return {
      success: true,
      blingContactId: blingContactId ?? undefined,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erro de conexão";

    await supabase.from("supplier_data_logs").insert({
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
