import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/products/public
 * Lista produtos ativos para o formulário de orçamento público.
 * Usa service role para bypass de RLS - não requer autenticação.
 */
export async function GET() {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("products")
      .select(
        "id, name, description, price, image_url, print_area_image_url, category, available_colors, allows_custom_color"
      )
      .eq("is_active", true)
      .order("name");

    if (error) {
      const isColumnError =
        error.code === "42703" ||
        (error.message ?? "").toLowerCase().includes("print_area_image_url");
      if (isColumnError) {
        const { data: fallbackData, error: fallbackError } = await admin
          .from("products")
          .select(
            "id, name, description, price, image_url, category, available_colors, allows_custom_color"
          )
          .eq("is_active", true)
          .order("name");
        if (fallbackError) {
          console.error("[api/products/public] Fallback error:", fallbackError);
          return NextResponse.json(
            { error: fallbackError.message ?? "Erro ao buscar produtos" },
            { status: 500 }
          );
        }
        const products = (fallbackData ?? []).map((p) => ({
          ...p,
          print_area_image_url: null as string | null,
        }));
        return NextResponse.json(products);
      }
      console.error("[api/products/public] Supabase error:", error);
      return NextResponse.json(
        { error: error.message ?? "Erro ao buscar produtos" },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[api/products/public] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}
