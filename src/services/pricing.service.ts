import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

const supabase = createClient();

export type SalesChannel = Database["public"]["Enums"]["sales_channel"];

export type PricingTier = Database["public"]["Tables"]["pricing_tiers"]["Row"];
export type PricingVolumeDiscount =
  Database["public"]["Tables"]["pricing_volume_discounts"]["Row"];
type PricingVolumeDiscountInsert =
  Database["public"]["Tables"]["pricing_volume_discounts"]["Insert"];
type PricingVolumeDiscountUpdate =
  Database["public"]["Tables"]["pricing_volume_discounts"]["Update"];
export type PricingSettings =
  Database["public"]["Tables"]["pricing_settings"]["Row"];
type PricingSettingsUpdate =
  Database["public"]["Tables"]["pricing_settings"]["Update"];

// ============================================
// Faixas de preço por canal (pricing_tiers)
// ============================================

/** Todas as faixas de um produto, ordenadas por canal e quantidade. */
export async function getPricingTiers(productId: string) {
  const { data, error } = await supabase
    .from("pricing_tiers")
    .select("*")
    .eq("product_id", productId)
    .order("channel", { ascending: true })
    .order("min_qty", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Cria ou atualiza a faixa (product_id, channel, min_qty) com o preço informado.
 * Usa o unique(product_id, channel, min_qty) da tabela como chave de conflito.
 */
export async function upsertPricingTier(input: {
  product_id: string;
  channel: SalesChannel;
  min_qty: number;
  unit_price: number;
}) {
  const { data, error } = await supabase
    .from("pricing_tiers")
    .upsert(
      {
        product_id: input.product_id,
        channel: input.channel,
        min_qty: input.min_qty,
        unit_price: input.unit_price,
        is_active: true,
      },
      { onConflict: "product_id,channel,min_qty" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// Descontos por volume (pricing_volume_discounts)
// ============================================

export async function getVolumeDiscounts() {
  const { data, error } = await supabase
    .from("pricing_volume_discounts")
    .select("*")
    .order("channel", { ascending: true })
    .order("min_order_value", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createVolumeDiscount(input: PricingVolumeDiscountInsert) {
  const { data, error } = await supabase
    .from("pricing_volume_discounts")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateVolumeDiscount(
  id: string,
  input: PricingVolumeDiscountUpdate
) {
  const { data, error } = await supabase
    .from("pricing_volume_discounts")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteVolumeDiscount(id: string) {
  const { error } = await supabase
    .from("pricing_volume_discounts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ============================================
// Configurações gerais (pricing_settings — singleton id=true)
// ============================================

export async function getPricingSettings() {
  const { data, error } = await supabase
    .from("pricing_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Atualiza (ou cria) a linha singleton de configurações. */
export async function updatePricingSettings(input: PricingSettingsUpdate) {
  const { data, error } = await supabase
    .from("pricing_settings")
    .upsert({ ...input, id: true }, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}
