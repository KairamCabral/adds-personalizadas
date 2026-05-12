import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";
import {
  fetchTinyStockForProduct,
  type ProductColorMap,
} from "@/lib/tiny/supplier-stock-sync";

interface PreviewVariant {
  color_key: string | null;
  color_label: string | null;
  tiny_id: number | null;
  stock: number | null;
}

type AvailableColor = { key: string; label?: string };

function parseAvailableColors(value: unknown): AvailableColor[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is Record<string, unknown> => c != null && typeof c === "object")
    .map((c) => ({
      key: String(c.key ?? ""),
      label: typeof c.label === "string" ? c.label : undefined,
    }))
    .filter((c) => c.key.length > 0);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "MASTER" && profile?.role !== "GESTOR") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const productId = request.nextUrl.searchParams.get("product_id");
  const depositoIdRaw = request.nextUrl.searchParams.get("deposito_id");
  const depositoId = depositoIdRaw ? parseInt(depositoIdRaw, 10) : null;

  if (!productId) {
    return NextResponse.json({ error: "product_id é obrigatório." }, { status: 400 });
  }

  const connected = await isTinyConnected();
  if (!connected) {
    return NextResponse.json(
      { error: "Tiny ERP não conectado.", code: "TINY_NOT_CONNECTED" },
      { status: 422 }
    );
  }

  const admin = createAdminClient();
  const { data: product, error: prodErr } = await admin
    .from("products")
    .select("id, name, tiny_id, tiny_color_map, available_colors")
    .eq("id", productId)
    .single();

  if (prodErr || !product) {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  }

  const colors = parseAvailableColors(product.available_colors);
  const colorMap = (product.tiny_color_map as ProductColorMap | null) ?? {};

  try {
    const { results, errors } = await fetchTinyStockForProduct({
      tinyId: product.tiny_id,
      tinyColorMap: colorMap,
      depositoId,
    });

    const variants: PreviewVariant[] = [];

    if (Object.keys(colorMap).length === 0) {
      // produto sem cores mapeadas — uma linha única do tiny_id pai
      const r = results[0];
      variants.push({
        color_key: null,
        color_label: null,
        tiny_id: product.tiny_id,
        stock: r?.stock ?? null,
      });
    } else {
      for (const [colorKey, mapping] of Object.entries(colorMap)) {
        const colorMeta = colors.find((c) => c.key === colorKey);
        const result = results.find((r) => r.colorKey === colorKey);
        variants.push({
          color_key: colorKey,
          color_label: colorMeta?.label ?? colorKey,
          tiny_id: mapping?.tiny_id ?? null,
          stock: result?.stock ?? null,
        });
      }
    }

    return NextResponse.json({
      product_id: product.id,
      product_name: product.name,
      deposito_id: depositoId,
      variants,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { error: error.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[preview-stock]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
