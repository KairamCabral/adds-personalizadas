import type { SupabaseClient } from "@supabase/supabase-js";
import { tinyApiGet, TinyTokenExpiredError } from "@/lib/tiny-api";
import type { Database } from "@/types/database.types";
import { clientUpsertPayloadFromTinyContact } from "@/lib/tiny/contact-mapper";

/**
 * Verifica se o pedido é de personalizadas.
 * Critérios (OU, case-insensitive, subcadeia "personaliz"):
 * - Tag/marcador
 * - Categoria
 * - Depósito
 */
function isPersonalizadasOrder(raw: Record<string, unknown>): {
  isPersonalizadas: boolean;
  reason: string;
} {
  const needle = "personaliz";
  const contains = (s: unknown): boolean => {
    if (typeof s !== "string") return false;
    return s.toLowerCase().includes(needle);
  };

  // 1. Tags / marcadores (formatos comuns do Tiny V3)
  const marcadores =
    (raw.marcadores as unknown[]) ??
    (raw.tags as unknown[]) ??
    [];
  if (Array.isArray(marcadores)) {
    for (const m of marcadores) {
      if (typeof m === "string" && contains(m)) {
        return { isPersonalizadas: true, reason: `tag="${m}"` };
      }
      if (m && typeof m === "object") {
        const nome = (m as { nome?: string; tag?: string; descricao?: string }).nome ??
                     (m as { tag?: string }).tag ??
                     (m as { descricao?: string }).descricao;
        if (contains(nome)) {
          return { isPersonalizadas: true, reason: `tag="${nome}"` };
        }
      }
    }
  }

  // 2. Categoria
  const categoria = raw.categoria as Record<string, unknown> | string | undefined;
  if (typeof categoria === "string" && contains(categoria)) {
    return { isPersonalizadas: true, reason: `categoria="${categoria}"` };
  }
  if (categoria && typeof categoria === "object") {
    const nome = (categoria as { nome?: string; descricao?: string }).nome ??
                 (categoria as { descricao?: string }).descricao;
    if (contains(nome)) {
      return { isPersonalizadas: true, reason: `categoria="${nome}"` };
    }
  }

  // 3. Depósito
  const deposito = raw.deposito as Record<string, unknown> | string | undefined;
  if (typeof deposito === "string" && contains(deposito)) {
    return { isPersonalizadas: true, reason: `deposito="${deposito}"` };
  }
  if (deposito && typeof deposito === "object") {
    const nome = (deposito as { nome?: string; descricao?: string }).nome ??
                 (deposito as { descricao?: string }).descricao;
    if (contains(nome)) {
      return { isPersonalizadas: true, reason: `deposito="${nome}"` };
    }
  }

  return { isPersonalizadas: false, reason: "nenhum critério bateu" };
}

/** Labels de situação (string) como no webhook Tiny */
const TINY_SITUACAO_STRING_TO_STATUS: Record<
  string,
  Database["public"]["Enums"]["order_status"]
> = {
  "Em aberto": "FAZER",
  Aprovado: "CONFIRMACAO",
  "Em andamento": "PRODUCAO",
  "Preparando envio": "EXPEDICAO",
  Faturado: "FATURADO",
  Cancelado: "ARQUIVADO",
  Autorizada: "FATURADO",
};

/** Mapeia código numérico de situação Tiny (API) → status CRM */
export function mapTinyNumericSituacaoToStatus(
  situacao: number | string
): Database["public"]["Enums"]["order_status"] {
  const s = typeof situacao === "string" ? parseInt(situacao, 10) : situacao;
  switch (s) {
    case 8:
    case 0:
      return "FAZER";
    case 3:
      return "CONFIRMACAO";
    case 4:
      return "PRODUCAO";
    case 1:
      return "FATURADO";
    case 7:
    case 5:
    case 9:
      return "EXPEDICAO";
    case 6:
      return "ENTREGUE";
    case 2:
      return "ARQUIVADO";
    default:
      return "FAZER";
  }
}

/**
 * Unifica situação vinda da API (número) ou do webhook (string em português ou número).
 */
export function mapTinySituacaoToCrmStatus(
  situacao: unknown
): Database["public"]["Enums"]["order_status"] {
  if (situacao === null || situacao === undefined) return "FAZER";
  if (typeof situacao === "string") {
    const trimmed = situacao.trim();
    if (TINY_SITUACAO_STRING_TO_STATUS[trimmed]) {
      return TINY_SITUACAO_STRING_TO_STATUS[trimmed];
    }
    const n = parseInt(trimmed, 10);
    if (!Number.isNaN(n)) {
      return mapTinyNumericSituacaoToStatus(n);
    }
    return "FAZER";
  }
  if (typeof situacao === "number" && Number.isFinite(situacao)) {
    return mapTinyNumericSituacaoToStatus(situacao);
  }
  return "FAZER";
}

export function unwrapTinyOrderResponse(
  apiResponse: unknown
): Record<string, unknown> | null {
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

export function parseTinyDate(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function nextPositionForOrderStatus(
  supabase: SupabaseClient<Database>,
  status: Database["public"]["Enums"]["order_status"]
): Promise<number> {
  const { data: maxPos } = await supabase
    .from("orders")
    .select("position")
    .eq("status", status)
    .is("archived_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (maxPos?.position ?? 0) + 1;
}

type OrderItemInsert = {
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
};

export async function buildOrderItemsFromTinyRaw(
  supabase: SupabaseClient<Database>,
  raw: Record<string, unknown>,
  orderId: string
): Promise<OrderItemInsert[]> {
  const valor = raw.valor ?? raw.total ?? raw.valorTotal;
  const tinyItens =
    raw.itens ??
    raw.itensPedido ??
    raw.itens_pedido ??
    raw.produtos ??
    [];

  const itemsToInsert: OrderItemInsert[] = [];

  if (Array.isArray(tinyItens) && tinyItens.length > 0) {
    for (const ti of tinyItens) {
      const t = ti as Record<string, unknown>;
      const item = t.item ?? t.produto ?? ti;
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const productName =
        (row.nome as string | undefined) ??
        (row.descricao as string | undefined) ??
        (row.produto as { nome?: string; descricao?: string } | undefined)?.nome ??
        (row.produto as { nome?: string; descricao?: string } | undefined)?.descricao ??
        "Item";
      const qty = Number(row.quantidade ?? row.qtd ?? 1) || 1;
      const unitPrice =
        row.valorUnitario ??
        row.valor_unitario ??
        row.preco ??
        (row.produto as { preco?: number } | undefined)?.preco;
      const totalPrice =
        row.valorTotal ??
        row.valor_total ??
        row.valor ??
        (unitPrice != null ? Number(unitPrice) * qty : null);

      let productId: string | null = null;
      const prodNested = row.produto as Record<string, unknown> | undefined;
      const tinyProductId = prodNested?.id ?? row.produto_id ?? row.idProduto;
      if (tinyProductId != null) {
        const tid = typeof tinyProductId === "number" ? tinyProductId : Number(tinyProductId);
        if (Number.isFinite(tid)) {
          const { data: prod } = await supabase
            .from("products")
            .select("id")
            .eq("tiny_id", tid)
            .maybeSingle();
          productId = prod?.id ?? null;
        }
      }

      itemsToInsert.push({
        order_id: orderId,
        product_id: productId,
        product_name: String(productName),
        quantity: qty,
        unit_price: unitPrice != null ? Number(unitPrice) : null,
        total_price: totalPrice != null ? Number(totalPrice) : null,
      });
    }
  }

  if (itemsToInsert.length === 0 && valor != null) {
    const totalVal = Number(valor);
    if (!isNaN(totalVal) && totalVal > 0) {
      itemsToInsert.push({
        order_id: orderId,
        product_id: null,
        product_name: "Pedido",
        quantity: 1,
        unit_price: totalVal,
        total_price: totalVal,
      });
    }
  }

  return itemsToInsert;
}

/**
 * Busca o pedido na API Tiny e cria/atualiza cliente + pedido + itens no CRM.
 */
export async function importTinyOrderFromApi(
  supabase: SupabaseClient<Database>,
  tinyOrderId: number
): Promise<{ ok: boolean; message: string; orderId?: string }> {
  let tinyResponse: unknown;
  try {
    tinyResponse = await tinyApiGet(`/pedidos/${tinyOrderId}`);
  } catch (err) {
    if (err instanceof TinyTokenExpiredError) {
      return { ok: false, message: err.message };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Erro API Tiny: ${msg}` };
  }

  const raw = unwrapTinyOrderResponse(tinyResponse);
  if (!raw || raw.id == null) {
    return { ok: false, message: "Resposta Tiny sem pedido válido." };
  }

  // Filtrar: só criar pedido se for de personalizadas
  const filterCheck = isPersonalizadasOrder(raw);
  if (!filterCheck.isPersonalizadas) {
    console.info(
      `[tiny-order-import] Pedido Tiny #${raw.id} IGNORADO (${filterCheck.reason}). ` +
        `raw keys: ${Object.keys(raw).join(",")}`
    );
    return {
      ok: true,
      message: `Pedido Tiny #${raw.id} não é personalizada (${filterCheck.reason}).`,
    };
  }

  const idVal = raw.id;
  const resolvedTinyOrderId =
    typeof idVal === "number" ? idVal : Number(idVal);
  if (!Number.isFinite(resolvedTinyOrderId)) {
    return { ok: false, message: "ID do pedido inválido na resposta Tiny." };
  }

  const clienteEmbed = raw.cliente as Record<string, unknown> | undefined;
  const clienteIdRaw = clienteEmbed?.id ?? raw.idCliente;
  const clienteId =
    typeof clienteIdRaw === "number"
      ? clienteIdRaw
      : clienteIdRaw != null
        ? Number(clienteIdRaw)
        : NaN;

  if (!Number.isFinite(clienteId)) {
    return { ok: false, message: "Pedido Tiny sem cliente (id) associado." };
  }

  let contactPayload: Record<string, unknown> =
    clienteEmbed && typeof clienteEmbed === "object"
      ? { ...clienteEmbed, id: clienteId }
      : { id: clienteId };

  if (
    !contactPayload.nome &&
    !contactPayload.nomeFantasia &&
    (typeof raw.nomeCliente === "string" || typeof raw.nomeCliente === "number")
  ) {
    contactPayload = {
      ...contactPayload,
      nome: String(raw.nomeCliente),
    };
  }

  let clientRow = clientUpsertPayloadFromTinyContact(contactPayload);
  if (!clientRow) {
    clientRow = clientUpsertPayloadFromTinyContact({
      id: clienteId,
      nome: "Cliente",
    });
  }
  if (!clientRow) {
    return { ok: false, message: "Não foi possível montar dados do cliente." };
  }

  const { error: clientErr } = await supabase
    .from("clients")
    .upsert(clientRow as Database["public"]["Tables"]["clients"]["Insert"], {
      onConflict: "tiny_id",
    });

  if (clientErr) {
    return {
      ok: false,
      message: `Erro ao salvar cliente: ${clientErr.message}`,
    };
  }

  const { data: clientIdRow, error: clientFetchErr } = await supabase
    .from("clients")
    .select("id")
    .eq("tiny_id", clienteId)
    .maybeSingle();

  if (clientFetchErr || !clientIdRow?.id) {
    return {
      ok: false,
      message: clientFetchErr?.message ?? "Cliente não encontrado após upsert.",
    };
  }

  const clienteNome =
    (clienteEmbed?.nome as string | undefined) ??
    (typeof raw.nomeCliente === "string" ? raw.nomeCliente : null) ??
    clientRow.name ??
    "Cliente";

  const numeroPedido = raw.numeroPedido ?? raw.numero ?? resolvedTinyOrderId;
  const valor = raw.valor ?? raw.total ?? raw.valorTotal;
  const dataPrevista = raw.dataPrevista ?? raw.data_prevista;
  const dataPedido =
    raw.dataPedido ?? raw.data_pedido ?? raw.data ?? raw.dataCriacao;
  const situacao = raw.situacao ?? raw.status ?? 0;

  // Checar se pedido já existe no CRM — se sim, preservar status via mapeamento; se não, AUTOMATICO
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("tiny_order_id", resolvedTinyOrderId)
    .maybeSingle();

  const isNewOrder = !existingOrder;
  const status: Database["public"]["Enums"]["order_status"] = isNewOrder
    ? "AUTOMATICO"
    : mapTinySituacaoToCrmStatus(situacao);
  const position = await nextPositionForOrderStatus(supabase, status);

  const orderData: Database["public"]["Tables"]["orders"]["Insert"] = {
    title: `Pedido #${numeroPedido} - ${clienteNome}`,
    description: valor != null ? `Valor: R$ ${valor}` : null,
    client_id: clientIdRow.id,
    status,
    due_date: dataPrevista ? parseTinyDate(String(dataPrevista)) : null,
    order_date: dataPedido ? parseTinyDate(String(dataPedido)) : null,
    tiny_order_id: resolvedTinyOrderId,
    order_type: "PERSONALIZADO",
    priority: "NORMAL",
    position,
    is_pipeline_managed: true,
    origin: "TINY_WEBHOOK",
  };

  const { data: upsertedOrder, error: orderErr } = await supabase
    .from("orders")
    .upsert(orderData as Database["public"]["Tables"]["orders"]["Insert"], {
      onConflict: "tiny_order_id",
    })
    .select("id")
    .single();

  if (orderErr || !upsertedOrder?.id) {
    return {
      ok: false,
      message: orderErr?.message ?? "Falha ao upsert pedido.",
    };
  }

  const orderId = upsertedOrder.id;
  const itemsToInsert = await buildOrderItemsFromTinyRaw(supabase, raw, orderId);

  if (itemsToInsert.length > 0) {
    await supabase.from("order_items").delete().eq("order_id", orderId);
    await supabase.from("order_items").insert(itemsToInsert);
  }

  return {
    ok: true,
    message: `Pedido CRM criado/atualizado a partir do Tiny #${resolvedTinyOrderId}.`,
    orderId,
  };
}
