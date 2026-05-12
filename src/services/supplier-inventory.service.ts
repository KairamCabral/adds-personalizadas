import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
export {
  classifyDivergence,
  currentReferenceMonth,
  type DivergenceStatus,
} from "@/lib/supplier-inventory/divergence";

const supabase = createClient();

type InventoryRow = Database["public"]["Tables"]["supplier_inventories"]["Row"];
type InventoryItemRow = Database["public"]["Tables"]["supplier_inventory_items"]["Row"];
type InventoryItemUpdate = Database["public"]["Tables"]["supplier_inventory_items"]["Update"];
type InventoryStatus = Database["public"]["Enums"]["supplier_inventory_status"];
type InventoryPool = Database["public"]["Enums"]["supplier_inventory_pool"];

export type SupplierInventory = InventoryRow;
export type SupplierInventoryItem = InventoryItemRow;
export type SupplierInventoryItemWithProduct = InventoryItemRow & {
  product: {
    id: string;
    name: string;
    available_colors: unknown;
    inventory_pools: InventoryPool[] | null;
  } | null;
};

/** Lista inventários do fornecedor (mais recente primeiro). */
export async function getSupplierInventories(supplierId: string) {
  const { data, error } = await supabase
    .from("supplier_inventories")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("reference_month", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getInventoryById(id: string) {
  const { data, error } = await supabase
    .from("supplier_inventories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function getInventoryByMonth(supplierId: string, referenceMonth: string) {
  const { data, error } = await supabase
    .from("supplier_inventories")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("reference_month", referenceMonth)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getInventoryItems(inventoryId: string) {
  const { data, error } = await supabase
    .from("supplier_inventory_items")
    .select(`
      *,
      product:products(id, name, available_colors, inventory_pools)
    `)
    .eq("inventory_id", inventoryId)
    .order("pool", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SupplierInventoryItemWithProduct[];
}

export async function updateInventoryItem(
  itemId: string,
  changes: Pick<InventoryItemUpdate, "quantity_declared" | "tiny_quantity" | "notes">
) {
  const { data, error } = await supabase
    .from("supplier_inventory_items")
    .update(changes)
    .eq("id", itemId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateInventoryStatus(
  inventoryId: string,
  status: InventoryStatus,
  extra?: { rejected_reason?: string | null; notes?: string | null }
) {
  const patch: Record<string, unknown> = { status };
  if (status === "SUBMITTED") patch.submitted_at = new Date().toISOString();
  if (status === "APPROVED") patch.approved_at = new Date().toISOString();
  if (extra?.rejected_reason !== undefined) patch.rejected_reason = extra.rejected_reason;
  if (extra?.notes !== undefined) patch.notes = extra.notes;

  const { data, error } = await supabase
    .from("supplier_inventories")
    .update(patch)
    .eq("id", inventoryId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Dispara recompute completo via RPC. Usa committed atualizado + reclassifica. */
export async function recomputeInventory(inventoryId: string) {
  const { error } = await supabase.rpc("recompute_supplier_inventory", {
    p_inventory_id: inventoryId,
  });
  if (error) throw error;
}
