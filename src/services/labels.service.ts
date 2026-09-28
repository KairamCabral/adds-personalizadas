import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

/**
 * CRUD do catálogo de etiquetas de pedido (`order_label_types`). Browser client
 * sob RLS: todos leem; MASTER/GESTOR gerenciam. O `slug` é o valor gravado em
 * `order_labels.label` (FK). Etiquetas `is_system` (aplicadas por automação) não
 * podem ser excluídas.
 */
const supabase = createSupabaseClient();

export type LabelTypeRow =
  Database["public"]["Tables"]["order_label_types"]["Row"];

export interface LabelTypeInput {
  name: string;
  color: string;
  text_color?: string;
}

/** Slug ASCII UPPER_CASE a partir do nome (ex.: "Urgente!" -> "URGENTE"). */
export function slugifyLabel(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function getLabelTypes(): Promise<LabelTypeRow[]> {
  const { data, error } = await supabase
    .from("order_label_types")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createLabelType(
  input: LabelTypeInput
): Promise<LabelTypeRow> {
  const slug = slugifyLabel(input.name);
  if (!slug) throw new Error("Nome inválido para a etiqueta.");

  // Próximo sort_order (fim da lista).
  const { data: last } = await supabase
    .from("order_label_types")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (last?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("order_label_types")
    .insert({
      slug,
      name: input.name.trim(),
      color: input.color,
      text_color: input.text_color ?? "#ffffff",
      sort_order,
      is_system: false,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe uma etiqueta com esse nome.");
    }
    throw error;
  }
  return data;
}

export async function updateLabelType(
  slug: string,
  patch: Partial<
    Pick<LabelTypeRow, "name" | "color" | "text_color" | "is_active" | "sort_order">
  >
): Promise<LabelTypeRow> {
  const { data, error } = await supabase
    .from("order_label_types")
    .update(patch)
    .eq("slug", slug)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Exclui uma etiqueta. Bloqueia se for de sistema ou se estiver aplicada em
 * algum pedido (a FK também barra, mas o pré-check dá mensagem clara — a UI
 * oferece "desativar" nesses casos).
 */
export async function deleteLabelType(row: LabelTypeRow): Promise<void> {
  if (row.is_system) {
    throw new Error("Etiqueta do sistema não pode ser excluída.");
  }
  const { count } = await supabase
    .from("order_labels")
    .select("id", { count: "exact", head: true })
    .eq("label", row.slug);
  if ((count ?? 0) > 0) {
    throw new Error(
      "Etiqueta em uso em pedidos — desative-a em vez de excluir."
    );
  }
  const { error } = await supabase
    .from("order_label_types")
    .delete()
    .eq("slug", row.slug);
  if (error) throw error;
}
