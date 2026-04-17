import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tinyApiGet, TinyTokenExpiredError } from "@/lib/tiny-api";

const TINY_SITUACAO_MAP: Record<number, string> = {
  8: "Dados Incompletos",
  0: "Aberto",
  3: "Aprovado",
  4: "Preparando Envio",
  1: "Faturado",
  7: "Pronto p/ Envio",
  5: "Enviado",
  6: "Entregue",
  2: "Cancelado",
  9: "Não Entregue",
};

type TinyLineItem = {
  produto: {
    id?: number;
    sku?: string;
    descricao?: string;
    tipo?: string;
  };
  quantidade: number;
  valorUnitario: number;
  infoAdicional?: string;
};

function unwrapTinyOrderResponse(apiResponse: unknown): Record<string, unknown> | null {
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
  if ("id" in r) return r;
  return null;
}

function normalizeProduto(raw: unknown): TinyLineItem["produto"] {
  if (!raw || typeof raw !== "object") {
    return { id: 0, descricao: "—", sku: "" };
  }
  let p = raw as Record<string, unknown>;
  if (p.produto && typeof p.produto === "object") {
    p = p.produto as Record<string, unknown>;
  }
  return {
    id: typeof p.id === "number" ? p.id : Number(p.id) || 0,
    sku: typeof p.sku === "string" ? p.sku : p.codigo != null ? String(p.codigo) : "",
    descricao:
      typeof p.descricao === "string"
        ? p.descricao
        : typeof p.nome === "string"
          ? p.nome
          : "—",
    tipo: typeof p.tipo === "string" ? p.tipo : undefined,
  };
}

function normalizeTinyOrderItems(raw: unknown): TinyLineItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TinyLineItem[] = [];
  for (const row of raw) {
    const line =
      row && typeof row === "object" && "item" in (row as object)
        ? (row as { item?: unknown }).item
        : row;
    if (!line || typeof line !== "object") continue;
    const l = line as Record<string, unknown>;
    const produto = normalizeProduto(l.produto);
    const q = Number(l.quantidade ?? 0);
    const vu = Number(
      l.valorUnitario ?? l.valor_unitario ?? l.valorUnitarioPedido ?? 0
    );
    out.push({
      produto,
      quantidade: Number.isFinite(q) ? q : 0,
      valorUnitario: Number.isFinite(vu) ? vu : 0,
      infoAdicional:
        typeof l.infoAdicional === "string" ? l.infoAdicional : undefined,
    });
  }
  return out;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id: orderId } = await context.params;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        id, order_number, title, tiny_order_id, status,
        items:order_items(
          id, product_name, quantity,
          product:products(id, bling_sku, bling_color_sku_map)
        )
      `
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Pedido não encontrado no CRM." },
        { status: 404 }
      );
    }

    if (!order.tiny_order_id) {
      return NextResponse.json(
        {
          error: "Este pedido não tem vínculo com o Tiny ERP.",
          noTinyLink: true,
        },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isPrestador = profile?.role === "PRESTADOR";

    let tinyOrder: unknown;
    try {
      tinyOrder = await tinyApiGet(`/pedidos/${order.tiny_order_id}`);
    } catch (err) {
      if (err instanceof TinyTokenExpiredError) {
        return NextResponse.json(
          { error: err.message, code: "TINY_RECONNECT" },
          { status: 401 }
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Erro ao buscar pedido no Tiny: ${msg}` },
        { status: 502 }
      );
    }

    const tinyData = unwrapTinyOrderResponse(tinyOrder);

    if (!tinyData || tinyData.id == null) {
      return NextResponse.json(
        { error: "Pedido não encontrado no Tiny." },
        { status: 404 }
      );
    }

    const crmSkus = new Set<string>();
    for (const item of order.items ?? []) {
      const row = item as {
        product?: {
          bling_sku?: string | null;
          bling_color_sku_map?: Record<string, string> | null;
        } | null;
      };
      const product = row.product;
      if (!product) continue;
      if (product.bling_sku) {
        crmSkus.add(String(product.bling_sku).toUpperCase().trim());
      }
      if (product.bling_color_sku_map && typeof product.bling_color_sku_map === "object") {
        for (const sku of Object.values(product.bling_color_sku_map)) {
          if (typeof sku === "string") {
            crmSkus.add(sku.toUpperCase().trim());
          }
        }
      }
    }

    const tinyItens = normalizeTinyOrderItems(tinyData.itens);

    const personalizedItems: TinyLineItem[] = [];
    const otherItems: TinyLineItem[] = [];

    for (const item of tinyItens) {
      const sku = (item.produto?.sku ?? "").toUpperCase().trim();
      const isPersonalized = Boolean(sku && crmSkus.has(sku));
      if (isPersonalized) {
        personalizedItems.push(item);
      } else {
        otherItems.push(item);
      }
    }

    const clienteRaw = tinyData.cliente as Record<string, unknown> | undefined;
    const cliente = clienteRaw && typeof clienteRaw === "object" ? clienteRaw : {};

    const maskedCliente = {
      nome: typeof cliente.nome === "string" ? cliente.nome : "",
      fantasia:
        typeof cliente.fantasia === "string" ? cliente.fantasia : null,
      tipoPessoa:
        cliente.tipoPessoa === "J" || cliente.tipoPessoa === "F"
          ? cliente.tipoPessoa
          : "F",
      cpfCnpj: typeof cliente.cpfCnpj === "string" ? cliente.cpfCnpj : "",
      telefone: isPrestador ? null : (cliente.telefone as string | null | undefined) ?? null,
      celular: isPrestador ? null : (cliente.celular as string | null | undefined) ?? null,
      email: isPrestador ? null : (cliente.email as string | null | undefined) ?? null,
      endereco: cliente.endereco ?? null,
    };

    let enderecoEntrega: unknown = tinyData.enderecoEntrega ?? null;
    if (
      enderecoEntrega &&
      typeof enderecoEntrega === "object" &&
      isPrestador
    ) {
      const copy = { ...(enderecoEntrega as Record<string, unknown>) };
      delete copy.telefone;
      enderecoEntrega = copy;
    }

    const situacaoNum = Number(tinyData.situacao);
    const situacaoLabel = Number.isFinite(situacaoNum)
      ? TINY_SITUACAO_MAP[situacaoNum] ?? `Status ${situacaoNum}`
      : `Status ${String(tinyData.situacao ?? "")}`;

    const transportRaw = tinyData.transportador as
      | Record<string, unknown>
      | undefined
      | null;
    const formaEnvio = transportRaw?.formaEnvio as
      | { nome?: string }
      | string
      | undefined;
    const transportador = transportRaw
      ? {
          nome:
            typeof transportRaw.nome === "string" ? transportRaw.nome : "",
          codigoRastreamento:
            typeof transportRaw.codigoRastreamento === "string"
              ? transportRaw.codigoRastreamento
              : null,
          urlRastreamento:
            typeof transportRaw.urlRastreamento === "string"
              ? transportRaw.urlRastreamento
              : null,
          formaEnvio:
            typeof formaEnvio === "object" && formaEnvio?.nome
              ? formaEnvio.nome
              : typeof formaEnvio === "string"
                ? formaEnvio
                : null,
        }
      : null;

    const response = {
      tinyOrderId: tinyData.id,
      numeroPedido: tinyData.numeroPedido,
      data: tinyData.data,
      dataPrevista: tinyData.dataPrevista ?? null,
      dataEntrega: tinyData.dataEntrega ?? null,
      dataEnvio: tinyData.dataEnvio ?? null,
      situacao: Number.isFinite(situacaoNum) ? situacaoNum : tinyData.situacao,
      situacaoLabel,

      valorTotalProdutos: Number(tinyData.valorTotalProdutos ?? 0) || 0,
      valorTotalPedido: Number(tinyData.valorTotalPedido ?? 0) || 0,
      valorDesconto: Number(tinyData.valorDesconto ?? 0) || 0,
      valorFrete: Number(tinyData.valorFrete ?? 0) || 0,

      cliente: maskedCliente,
      enderecoEntrega,

      personalizedItems,
      otherItems,
      totalItems: tinyItens.length,

      deposito: tinyData.deposito ?? null,
      vendedor: tinyData.vendedor ?? null,
      transportador,

      observacoes: tinyData.observacoes ?? null,
      observacoesInternas: isPrestador
        ? null
        : (tinyData.observacoesInternas ?? null),

      crmOrderId: order.id,
      crmOrderNumber: order.order_number,
      crmStatus: order.status,

      // Flag pra frontend esconder valores monetários
      hideValues: isPrestador,
    };

    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { error: err.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    const message = err instanceof Error ? err.message : "Erro interno.";
    console.error("[tiny-complete]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
