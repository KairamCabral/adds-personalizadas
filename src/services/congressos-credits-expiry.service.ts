import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Expiração automática de créditos de cashback (Épico 6). Server-only (admin
 * client) — roda no cron diário. Marca `ATIVO → EXPIRADO` os créditos cuja
 * `valid_until` já passou. Créditos sem validade (`valid_until IS NULL`) nunca
 * expiram. A UI também deriva o estado, mas isto mantém o status real correto
 * para contadores/consultas.
 */
export interface ExpireCreditsResult {
  expired: number;
}

export async function expireCongressCredits(): Promise<ExpireCreditsResult> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("event_credits")
    .update({ status: "EXPIRADO" })
    .eq("status", "ATIVO")
    .lt("valid_until", today)
    .select("id");

  if (error) throw error;
  return { expired: data?.length ?? 0 };
}
