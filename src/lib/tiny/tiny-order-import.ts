import type { SupabaseClient } from "@supabase/supabase-js";
import { tinyApiGet, TinyTokenExpiredError } from "@/lib/tiny-api";
import type { Database, Json } from "@/types/database.types";
import { clientUpsertPayloadFromTinyContact } from "@/lib/tiny/contact-mapper";
import { fetchFirstPessoaContatoForChat } from "@/lib/tiny/tiny-contact-pessoas";

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
  Cancelado: "ARQUIVADO",
  Faturado: "FATURADO",
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
  personalization: Json | null;
};

export async function buildOrderItemsFromTinyRaw(
  supabase: SupabaseClient<Database>,
  raw: Record<string, unknown>,
  orderId: string
): Promise<OrderItemInsert[]> {
  const tinyItens =
    raw.itens ??
    raw.itensPedido ??
    raw.itens_pedido ??
    raw.produtos ??
    [];

  const itemsToInsert: OrderItemInsert[] = [];

  if (!Array.isArray(tinyItens) || tinyItens.length === 0) {
    return itemsToInsert;
  }

  // Pré-carregar produtos personalizados do CRM UMA VEZ
  // (evita N queries se o pedido tiver muitos itens)
  const { data: personalizedProducts } = await supabase
    .from("products")
    .select("id, name, available_colors, tiny_id, bling_sku, bling_color_sku_map, tiny_color_map")
    .eq("product_type", "personalizado");

  type ProdMatcher = {
    id: string;
    name: string;
    colorKeyToLabel: Map<string, string>;
    tiny_id: number | null;
    variationTinyIds: Set<number>;
    skus: Set<string>;
    skuToColor: Map<string, string>;
    tinyIdToColor: Map<number, string>;
  };

  const matchers: ProdMatcher[] = (personalizedProducts ?? []).map((p) => {
    const skus = new Set<string>();
    const variationTinyIds = new Set<number>();
    const skuToColor = new Map<string, string>();
    const tinyIdToColor = new Map<number, string>();

    // Mapeia color key → label legível a partir de available_colors
    const colorKeyToLabel = new Map<string, string>();
    if (Array.isArray(p.available_colors)) {
      for (const c of p.available_colors as { key?: string; label?: string }[]) {
        if (typeof c.key === "string" && typeof c.label === "string") {
          colorKeyToLabel.set(c.key, c.label);
        }
      }
    }

    // bling_sku do produto pai (sem cor específica)
    if (p.bling_sku && typeof p.bling_sku === "string") {
      skus.add(p.bling_sku.toUpperCase().trim());
    }

    // SKUs do bling_color_sku_map (variações no Bling — identifica cor)
    if (p.bling_color_sku_map && typeof p.bling_color_sku_map === "object") {
      for (const [colorKey, sku] of Object.entries(p.bling_color_sku_map as Record<string, unknown>)) {
        if (typeof sku === "string") {
          const skuUpper = sku.toUpperCase().trim();
          skus.add(skuUpper);
          skuToColor.set(skuUpper, colorKey);
        }
      }
    }

    // tiny_color_map: adicionar SKUs Tiny e tiny_ids das variações (identifica cor)
    if (p.tiny_color_map && typeof p.tiny_color_map === "object") {
      for (const [colorKey, variation] of Object.entries(p.tiny_color_map as Record<string, unknown>)) {
        if (variation && typeof variation === "object") {
          const v = variation as { sku?: unknown; tiny_id?: unknown };
          if (typeof v.sku === "string") {
            const skuUpper = v.sku.toUpperCase().trim();
            skus.add(skuUpper);
            skuToColor.set(skuUpper, colorKey);
          }
          if (typeof v.tiny_id === "number" && Number.isFinite(v.tiny_id)) {
            variationTinyIds.add(v.tiny_id);
            tinyIdToColor.set(v.tiny_id, colorKey);
          } else if (typeof v.tiny_id === "string") {
            const n = Number(v.tiny_id);
            if (Number.isFinite(n)) {
              variationTinyIds.add(n);
              tinyIdToColor.set(n, colorKey);
            }
          }
        }
      }
    }

    return {
      id: p.id,
      name: p.name ?? "",
      colorKeyToLabel,
      tiny_id: p.tiny_id,
      variationTinyIds,
      skus,
      skuToColor,
      tinyIdToColor,
    };
  });

  // Função pura de matching — retorna produto, cor e label da cor identificados
  const matchProduct = (
    tinyProductId: number | null,
    itemSku: string | null
  ): { productId: string; productName: string; color: string | null; colorLabel: string | null } | null => {
    const skuUpper = itemSku?.toUpperCase().trim() ?? "";
    for (const m of matchers) {
      // Match 1: tiny_id do produto pai (não identifica cor específica)
      if (tinyProductId != null && m.tiny_id === tinyProductId) {
        return { productId: m.id, productName: m.name, color: null, colorLabel: null };
      }
      // Match 2: tiny_id de variação — identifica cor
      if (tinyProductId != null && m.variationTinyIds.has(tinyProductId)) {
        const color = m.tinyIdToColor.get(tinyProductId) ?? null;
        return {
          productId: m.id,
          productName: m.name,
          color,
          colorLabel: color ? (m.colorKeyToLabel.get(color) ?? null) : null,
        };
      }
      // Match 3: SKU — identifica cor quando mapeado
      if (skuUpper && m.skus.has(skuUpper)) {
        const color = m.skuToColor.get(skuUpper) ?? null;
        return {
          productId: m.id,
          productName: m.name,
          color,
          colorLabel: color ? (m.colorKeyToLabel.get(color) ?? null) : null,
        };
      }
    }
    return null;
  };

  for (const ti of tinyItens) {
    const t = ti as Record<string, unknown>;
    // Suporta dois formatos do Tiny:
    //   1) { item: { produto, quantidade, valorUnitario, ... } }
    //   2) { produto, quantidade, valorUnitario, ... }
    const lineItem = (t.item && typeof t.item === "object" ? t.item : t) as Record<string, unknown>;
    if (!lineItem || typeof lineItem !== "object") continue;

    // Nível aninhado com id/sku/descricao
    const prodNested = lineItem.produto as Record<string, unknown> | undefined;

    const productName =
      (typeof lineItem.nome === "string" ? lineItem.nome : undefined) ??
      (typeof lineItem.descricao === "string" ? lineItem.descricao : undefined) ??
      (typeof prodNested?.nome === "string" ? prodNested.nome : undefined) ??
      (typeof prodNested?.descricao === "string" ? prodNested.descricao : undefined) ??
      "Item";

    // lê do nível EXTERNO (lineItem), não do produto aninhado
    const qty = Number(lineItem.quantidade ?? lineItem.qtd ?? 1) || 1;

    const unitPrice =
      lineItem.valorUnitario ??
      lineItem.valor_unitario ??
      lineItem.preco ??
      (typeof prodNested?.preco === "number" ? prodNested.preco : undefined);

    const totalPrice =
      lineItem.valorTotal ??
      lineItem.valor_total ??
      lineItem.valor ??
      (unitPrice != null ? Number(unitPrice) * qty : null);

    // Extrair tiny_id e SKU para matching
    const tinyProductIdRaw = prodNested?.id ?? lineItem.produto_id ?? lineItem.idProduto;
    let tinyProductId: number | null = null;
    if (tinyProductIdRaw != null) {
      const tid =
        typeof tinyProductIdRaw === "number"
          ? tinyProductIdRaw
          : Number(tinyProductIdRaw);
      tinyProductId = Number.isFinite(tid) ? tid : null;
    }

    const itemSku =
      (typeof lineItem.codigo === "string" ? lineItem.codigo : null) ??
      (typeof lineItem.sku === "string" ? lineItem.sku : null) ??
      (typeof prodNested?.sku === "string" ? (prodNested.sku as string) : null) ??
      (typeof prodNested?.codigo === "string" ? (prodNested.codigo as string) : null) ??
      null;

    const match = matchProduct(tinyProductId, itemSku);

    if (!match) {
      console.info(
        `[tiny-order-import] Item "${productName}" (sku=${itemSku ?? "—"}, tiny_id=${tinyProductId ?? "—"}) IGNORADO no CRM: não bateu com produto personalizado cadastrado.`
      );
      continue;
    }

    // Quando a cor é identificada, usa o nome canônico do CRM + label da cor
    // para evitar que o Tiny retorne sempre o nome da variação-pai (ex.: "Lilás")
    // mesmo quando o item é de outra cor.
    const resolvedProductName: string = (() => {
      if (match.color && match.colorLabel) {
        // Remove sufixo de cor existente (ex.: " – Lilás" ou " - Lilás") e adiciona o correto
        const base = match.productName.replace(/\s*[-–—]\s*[^-–—]+$/, "").trim();
        return `${base} – ${match.colorLabel}`;
      }
      return match.productName || String(productName);
    })();

    itemsToInsert.push({
      order_id: orderId,
      product_id: match.productId,
      product_name: resolvedProductName,
      quantity: qty,
      unit_price: unitPrice != null ? Number(unitPrice) : null,
      total_price: totalPrice != null ? Number(totalPrice) : null,
      personalization: match.color ? { colors: [match.color], custom_color: null } : null,
    });
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

  // Observações internas do Tiny → campo description do CRM (exibido como "Personalização" no pipeline)
  const obsInternas =
    (typeof raw.observacoesInternas === "string" ? raw.observacoesInternas.trim() : undefined) ??
    (typeof raw.obs_internas === "string" ? raw.obs_internas.trim() : undefined) ??
    null;

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

  // Preencher "Contato do chat" a partir das Pessoas de Contato do Tiny (só no primeiro import)
  let contactChat: { contact_name: string; contact_phone: string } | null = null;
  if (isNewOrder) {
    const picked = await fetchFirstPessoaContatoForChat(clienteId);
    if (picked) {
      contactChat = { contact_name: picked.nome, contact_phone: picked.telefone };
    }
  }

  const orderData: Database["public"]["Tables"]["orders"]["Insert"] = {
    title: `Pedido #${numeroPedido} - ${clienteNome}`,
    description: obsInternas || (valor != null ? `Valor: R$ ${valor}` : null),
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
    ...(contactChat ? { contact_name: contactChat.contact_name, contact_phone: contactChat.contact_phone } : {}),
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
