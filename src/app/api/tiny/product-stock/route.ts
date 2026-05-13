import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";
import {
  fetchTinyStockForProduct,
  type ProductColorMap,
} from "@/lib/tiny/supplier-stock-sync";
import type { Database } from "@/types/database.types";

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_id } = body as { product_id: string };

    if (!product_id) {
      return NextResponse.json({ error: "product_id é obrigatório" }, { status: 400 });
    }

    const supabase = getServiceClient();

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

    const colorMap = (product.tiny_color_map as ProductColorMap | null) ?? {};

    const { results, errors } = await fetchTinyStockForProduct({
      tinyId: product.tiny_id,
      tinyColorMap: colorMap,
    });

    // Atualiza tiny_color_map com tiny_stock por cor + total geral
    const updatedColorMap: ProductColorMap = { ...colorMap };
    let totalStock = 0;
    let hasColorResult = false;

    for (const r of results) {
      if (r.colorKey) {
        hasColorResult = true;
        updatedColorMap[r.colorKey] = {
          ...updatedColorMap[r.colorKey],
          tiny_stock: r.totalSaldo,
        };
        totalStock += r.totalSaldo;
      } else {
        totalStock = r.totalSaldo; // produto pai sem variantes
      }
    }

    if (!hasColorResult && results.length === 0) {
      totalStock = 0;
    }

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
