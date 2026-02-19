import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export async function getUsers() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active, last_login_at")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return data;
}

export interface UpdateProfileData {
  full_name?: string;
  role?: "MASTER" | "GESTOR" | "PRESTADOR";
  is_active?: boolean;
}

export async function updateProfile(
  supabase: SupabaseClient,
  id: string,
  data: UpdateProfileData
) {
  const { error } = await supabase
    .from("profiles")
    .update(data)
    .eq("id", id);

  if (error) throw error;
}
