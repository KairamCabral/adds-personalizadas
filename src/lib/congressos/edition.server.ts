import { createAdminClient } from "@/lib/supabase/admin";

/** Campos seguros da edição para exposição na landing pública. */
export interface PublicEdition {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  gift_name: string | null;
  cashback_enabled: boolean;
}

/**
 * Lê a edição por slug com o admin client (server-only — nunca importar em
 * client component). Retorna null se não existir. O caller decide o que fazer
 * com `is_active`.
 */
export async function getEditionBySlug(
  slug: string
): Promise<PublicEdition | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_editions")
    .select("id, slug, name, is_active, gift_name, cashback_enabled")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as PublicEdition;
}
