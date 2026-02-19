import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import type { Supplier } from "@/types/database.types";

const supabase = createClient();

type SupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];
type SupplierUpdate = Database["public"]["Tables"]["suppliers"]["Update"];

export async function getSuppliers() {
  const { data, error } = await supabase
    .from("suppliers")
    .select(`
      *,
      agreements:supplier_agreements(*),
      logs:supplier_data_logs(*)
    `)
    .order("name", { ascending: true });

  if (error) throw error;

  const suppliers = (data ?? []) as (Supplier & {
    agreements: Array<{ created_at: string; status: string; signed_at?: string; token_expires_at: string }>;
    logs: Array<{ sent_at: string; status: string }>;
  })[];
  suppliers.forEach((s) => {
    if (s.agreements) {
      s.agreements.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    if (s.logs) {
      s.logs.sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
      );
    }
  });
  return suppliers;
}

export async function getSupplierById(id: string) {
  const { data, error } = await supabase
    .from("suppliers")
    .select(`
      *,
      agreements:supplier_agreements(*),
      logs:supplier_data_logs(*)
    `)
    .eq("id", id)
    .single();

  if (error) throw error;

  // Ordenar agreements por created_at desc e logs por sent_at desc
  const supplier = data as Supplier & {
    agreements: Array<{ created_at: string }>;
    logs: Array<{ sent_at: string; order_id: string }>;
  };
  if (supplier?.agreements) {
    supplier.agreements.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  if (supplier?.logs) {
    supplier.logs.sort(
      (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );
    supplier.logs = supplier.logs.slice(0, 20);
  }

  return supplier;
}

export async function createSupplier(data: SupplierInsert) {
  const { data: supplier, error } = await supabase
    .from("suppliers")
    .insert({
      ...data,
      is_active: false,
    })
    .select()
    .single();

  if (error) throw error;
  return supplier;
}

export async function updateSupplier(id: string, data: SupplierUpdate) {
  const { data: supplier, error } = await supabase
    .from("suppliers")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return supplier;
}

export async function deactivateSupplier(id: string, reason: string) {
  const { data: supplier, error } = await supabase
    .from("suppliers")
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivation_reason: reason,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return supplier;
}

export async function activateSupplier(id: string) {
  const { data: supplier, error } = await supabase
    .from("suppliers")
    .update({
      is_active: true,
      activated_at: new Date().toISOString(),
      deactivated_at: null,
      deactivation_reason: null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return supplier;
}
