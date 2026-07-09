import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

const supabase = createSupabaseClient();

type EventEditionInsert =
  Database["public"]["Tables"]["event_editions"]["Insert"];
type EventEditionUpdate =
  Database["public"]["Tables"]["event_editions"]["Update"];

export async function getEditions() {
  const { data, error } = await supabase
    .from("event_editions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getEditionById(id: string) {
  const { data, error } = await supabase
    .from("event_editions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createEdition(data: EventEditionInsert) {
  const { data: edition, error } = await supabase
    .from("event_editions")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return edition;
}

export async function updateEdition(id: string, data: EventEditionUpdate) {
  const { data: edition, error } = await supabase
    .from("event_editions")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return edition;
}

export async function deleteEdition(id: string) {
  const { error } = await supabase.from("event_editions").delete().eq("id", id);
  if (error) throw error;
}
