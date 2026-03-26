import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tinyApiGet, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";
import type { Database } from "@/types/database.types";

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface TinyProductDetail {
  id?: number;
  nome?: string;
  codigo?: string;
  estoque?: number | string;
  saldo?: number | string;
  // V3 pode retornar dentro de "data"
  data?: {
    id?: number;
    nome?: string;
    codigo?: string;
    estoque?: number | string;
    saldo?: number | string;
  };
}

function extractStock(raw: TinyProductDetail): number {
  const value =
    raw?.data?.estoque ??
    raw?.data?.saldo ??
    raw?.estoque ??
    raw?.saldo ??
    0;
  return typeof value === "string" ? parseFloat(value) || 0 : Number(value) || 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_id } = body as { product_id: string };

    if (!product_id) {
      return NextResponse.json({ error: "product_id é obrigatório" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Buscar produto no CRM
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("id, tiny_id, tiny_color_map")
      .eq("id", product_id)
      .single();

    if (fetchError || !product) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    const connected = await isTinyConnected();
    if (!connected) {
      return NextResponse.json(
        { error: "Tiny ERP não conectado. Configure em Configurações > Integrações." },
        { status: 422 }
      );
    }

    const colorMap = (product.tiny_color_map as Record<string, {
      tiny_id?: number | null;
      sku?: string | null;
      tiny_stock?: number | null;
    }>) ?? {};

    // Coletar todos os tiny_ids únicos para buscar (cores + produto pai)
    const tinyIdsToFetch = new Map<number, string[]>(); // tiny_id → [colorKeys]

    for (const [colorKey, mapping] of Object.entries(colorMap)) {
      if (mapping?.tiny_id) {
        const existing = tinyIdsToFetch.get(mapping.tiny_id) ?? [];
        existing.push(colorKey);
        tinyIdsToFetch.set(mapping.tiny_id, existing);
      }
    }

    // Se produto pai tem tiny_id mas não tem cores mapeadas, buscar o pai
    const hasMappedColors = tinyIdsToFetch.size > 0;
    const productTinyId = product.tiny_id;

    const results: { tinyId: number; stock: number; colorKeys: string[] }[] = [];
    const errors: string[] = [];

    // Buscar estoque de cada variante
    for (const [tinyId, colorKeys] of tinyIdsToFetch) {
      try {
        const raw = await tinyApiGet<TinyProductDetail>(`/produtos/${tinyId}`);
        const stock = extractStock(raw);
        results.push({ tinyId, stock, colorKeys });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`ID ${tinyId}: ${msg}`);
        console.error(`[product-stock] Erro ao buscar estoque para tiny_id=${tinyId}:`, msg);
      }
    }

    // Se não tem variantes mapeadas mas tem tiny_id no produto pai
    if (!hasMappedColors && productTinyId) {
      try {
        const raw = await tinyApiGet<TinyProductDetail>(`/produtos/${productTinyId}`);
        const stock = extractStock(raw);
        results.push({ tinyId: productTinyId, stock, colorKeys: [] });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Produto pai ${productTinyId}: ${msg}`);
      }
    }

    // Atualizar colorMap com os estoques buscados
    const updatedColorMap = { ...colorMap };
    let totalStock = 0;

    for (const { stock, colorKeys } of results) {
      totalStock += stock;
      for (const colorKey of colorKeys) {
        updatedColorMap[colorKey] = {
          ...updatedColorMap[colorKey],
          tiny_stock: stock,
        };
      }
    }

    // Se apenas produto pai (sem variantes), total = seu estoque
    if (!hasMappedColors && results.length > 0) {
      totalStock = results[0].stock;
    }

    // Salvar no banco
    const { error: updateError } = await supabase
      .from("products")
      .update({
        tiny_color_map: updatedColorMap,
        tiny_stock: totalStock,
        last_stock_sync: new Date().toISOString(),
      })
      .eq("id", product_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      total_stock: totalStock,
      synced: results.length,
      errors: errors.length > 0 ? errors : undefined,
      color_map: updatedColorMap,
    });
  } catch (error) {
    if (error instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { error: error.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[product-stock]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
