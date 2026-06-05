import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/pricing/public
 * Retorna contexto de preços do canal DENTISTA para o formulário público de orçamento.
 * Usa service role — não requer autenticação (bypass de RLS).
 */
export async function GET() {
  try {
    const admin = createAdminClient();

    const [tiersResult, settingsResult, volumeResult] = await Promise.all([
      admin
        .from("pricing_tiers")
        .select("product_id, min_qty, unit_price")
        .eq("channel", "DENTISTA")
        .eq("is_active", true)
        .order("product_id")
        .order("min_qty"),

      admin
        .from("pricing_settings")
        .select("avista_discount_pct, valid_until")
        .eq("id", true)
        .maybeSingle(),

      admin
        .from("pricing_volume_discounts")
        .select("min_order_value, discount_pct")
        .eq("channel", "DENTISTA")
        .eq("is_active", true)
        .order("min_order_value"),
    ]);

    if (tiersResult.error) {
      console.error("[api/pricing/public] tiers error:", tiersResult.error);
    }
    if (settingsResult.error) {
      console.error("[api/pricing/public] settings error:", settingsResult.error);
    }
    if (volumeResult.error) {
      console.error("[api/pricing/public] volume error:", volumeResult.error);
    }

    return NextResponse.json({
      tiers: tiersResult.data ?? [],
      settings: settingsResult.data ?? null,
      volumeDiscounts: volumeResult.data ?? [],
    });
  } catch (err) {
    console.error("[api/pricing/public] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}
