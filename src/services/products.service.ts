import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

const supabase = createClient();

type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

export async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getActiveProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getProductById(id: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

function isColumnMissingError(error: { code?: string; message?: string }): boolean {
  const msg = (error.message ?? "").toLowerCase();
  const code = String(error.code ?? "");
  return (
    code === "42703" ||
    msg.includes("print_area_image_url") ||
    (msg.includes("column") && (msg.includes("does not exist") || msg.includes("undefined")))
  );
}

function withoutPrintAreaImageUrl<T extends Record<string, unknown>>(obj: T): Omit<T, "print_area_image_url"> {
  const { print_area_image_url: _, ...rest } = obj;
  return rest;
}

export async function createProduct(data: ProductInsert) {
  const { data: product, error } = await supabase
    .from("products")
    .insert(data)
    .select()
    .single();

  if (error && isColumnMissingError(error)) {
    const fallback = withoutPrintAreaImageUrl(data as Record<string, unknown>) as ProductInsert;
    const { data: product2, error: error2 } = await supabase
      .from("products")
      .insert(fallback)
      .select()
      .single();
    if (error2) throw error2;
    return product2;
  }
  if (error) throw error;
  return product;
}

export async function updateProduct(id: string, data: ProductUpdate) {
  const { data: product, error } = await supabase
    .from("products")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error && isColumnMissingError(error)) {
    const fallback = withoutPrintAreaImageUrl(data as Record<string, unknown>) as ProductUpdate;
    const { data: product2, error: error2 } = await supabase
      .from("products")
      .update(fallback)
      .eq("id", id)
      .select()
      .single();
    if (error2) throw error2;
    return product2;
  }
  if (error) throw error;
  return product;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}
