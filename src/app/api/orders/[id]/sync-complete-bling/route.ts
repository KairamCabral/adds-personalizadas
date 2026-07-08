import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tinyApiGet } from "@/lib/tiny-api";
import { sendOrderToBling } from "@/services/bling.service";

function unwrapTinyOrderResponse(
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

export async function POST(
  request: NextRequest,
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
    const body = await request.json().catch(() => ({}));
    let supplierId = body.supplierId as string | undefined;

    if (!supplierId) {
      const { data: suppliers } = await supabase
        .from("suppliers")
        .select("id")
        .eq("is_active", true)
        .limit(1);
      supplierId = suppliers?.[0]?.id ?? undefined;
    }

    if (!supplierId) {
      return NextResponse.json(
        {
          error:
            "Nenhum fornecedor ativo. Ative em Configurações → Fornecedores.",
        },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, tiny_order_id, client_id, title")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    if (!order.tiny_order_id) {
      return NextResponse.json(
        { error: "Pedido não tem vínculo com o Tiny." },
        { status: 400 }
      );
    }

    const result = await sendOrderToBling(supplierId, orderId, user.id, supabase);

    let tinyExtras: string[] = [];
    try {
      const tinyOrder = await tinyApiGet(`/pedidos/${order.tiny_order_id}`);
      const tinyData = unwrapTinyOrderResponse(tinyOrder);
      const rawItens = (tinyData?.itens as unknown[]) ?? [];

      const { data: crmItems } = await supabase
        .from("order_items")
        .select("product:products(bling_sku, bling_color_sku_map, tiny_color_map)")
        .eq("order_id", orderId);

      // Identidades já cobertas pelos itens do CRM. Espelha buildBlingOrderPayload:
      // dedup por tiny_id e nome (preenchidos em tiny_color_map), com SKU de fallback,
      // porque o SKU do Tiny em tiny_color_map costuma vir vazio.
      const crmSkus = new Set<string>();
      const crmTinyIds = new Set<number>();
      const crmTinyNames = new Set<string>();
      for (const row of crmItems ?? []) {
        const item = row as {
          product?: {
            bling_sku?: string | null;
            bling_color_sku_map?: Record<string, string> | null;
            tiny_color_map?: Record<
              string,
              { sku?: string; name?: string; tiny_id?: number | string } | null
            > | null;
          } | null;
        };
        const p = item.product;
        if (p?.bling_sku) crmSkus.add(String(p.bling_sku).toUpperCase().trim());
        if (p?.bling_color_sku_map && typeof p.bling_color_sku_map === "object") {
          for (const sku of Object.values(p.bling_color_sku_map)) {
            if (typeof sku === "string") crmSkus.add(sku.toUpperCase().trim());
          }
        }
        if (p?.tiny_color_map && typeof p.tiny_color_map === "object") {
          for (const variation of Object.values(p.tiny_color_map)) {
            if (!variation || typeof variation !== "object") continue;
            if (typeof variation.sku === "string" && variation.sku.trim()) {
              crmSkus.add(variation.sku.toUpperCase().trim());
            }
            if (variation.tiny_id != null && Number.isFinite(Number(variation.tiny_id))) {
              crmTinyIds.add(Number(variation.tiny_id));
            }
            if (typeof variation.name === "string" && variation.name.trim()) {
              crmTinyNames.add(variation.name.toUpperCase().trim());
            }
          }
        }
      }

      for (const row of rawItens) {
        const line =
          row && typeof row === "object" && "item" in row
            ? (row as { item?: unknown }).item
            : row;
        if (!line || typeof line !== "object") continue;
        const l = line as Record<string, unknown>;
        let produto = l.produto as Record<string, unknown> | undefined;
        if (produto?.produto && typeof produto.produto === "object") {
          produto = produto.produto as Record<string, unknown>;
        }
        const sku = String(
          produto?.sku ?? produto?.codigo ?? ""
        )
          .toUpperCase()
          .trim();
        const q = Number(l.quantidade ?? 1);
        const desc =
          typeof produto?.descricao === "string"
            ? produto.descricao
            : "Item";
        const idRaw = produto?.id;
        const tinyId =
          idRaw != null && Number.isFinite(Number(idRaw)) ? Number(idRaw) : null;
        const name = desc.toUpperCase().trim();
        // Mesmo critério de extra do builder: só é extra se não casar por
        // tiny_id/nome e tiver SKU próprio não mapeado.
        const idMatched = tinyId != null && crmTinyIds.has(tinyId);
        const nameMatched = name.length > 0 && crmTinyNames.has(name);
        const isExtra =
          !idMatched && !nameMatched && sku.length > 0 && !crmSkus.has(sku);
        if (isExtra) {
          tinyExtras.push(`${desc} x${Number.isFinite(q) ? q : 1}`);
        }
      }
    } catch {
      // Tiny falhou ao listar extras — não impede o retorno do envio ao Bling
    }

    const success = result.orderSent;

    return NextResponse.json({
      success,
      contactSent: result.contactSent,
      orderSent: result.orderSent,
      blingOrderNumber: result.blingOrderNumber,
      error: result.error,
      tinyExtras,
      message: result.orderSent
        ? tinyExtras.length > 0
          ? `Pedido enviado ao Bling. ${tinyExtras.length} item(ns) extra(s) do Tiny incluídos nas observações.`
          : "Pedido enviado ao Bling com sucesso."
        : result.error ?? "Erro ao enviar.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    console.error("[sync-complete-bling]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
