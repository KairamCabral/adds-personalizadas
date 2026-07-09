import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Brinde (resgate) de um pré-cadastro de congresso. `token` (URL do QR) e
 * `short_code` (6 dígitos) identificam o brinde — nunca o documento.
 *
 * Server-only: importa o admin client (service role). Não importar em Client
 * Components.
 */
type AdminClient = ReturnType<typeof createAdminClient>;

export interface Redemption {
  token: string;
  short_code: string;
}

/** Lê a redemption já criada para a registration (idempotência). */
export async function fetchRedemption(
  supabase: AdminClient,
  registrationId: string
): Promise<Redemption | null> {
  const { data } = await supabase
    .from("event_gift_redemptions")
    .select("token, short_code")
    .eq("registration_id", registrationId)
    .maybeSingle();
  return data ?? null;
}

/** Gera short_code de 6 dígitos com retry em colisão (edition_id, short_code). */
export async function createRedemption(
  supabase: AdminClient,
  editionId: string,
  registrationId: string
): Promise<Redemption | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const shortCode = String(Math.floor(100000 + Math.random() * 900000));
    const { data, error } = await supabase
      .from("event_gift_redemptions")
      .insert({
        edition_id: editionId,
        registration_id: registrationId,
        short_code: shortCode,
      })
      .select("token, short_code")
      .single();

    if (!error && data) return data;

    // 23505 = unique_violation: colisão de short_code (retry) OU registration_id
    // já tem redemption (retorna a existente).
    if (error && error.code === "23505") {
      const existing = await fetchRedemption(supabase, registrationId);
      if (existing) return existing;
      continue; // colisão de short_code → tenta outro
    }

    console.error("[congressos/redemption] insert:", error);
    return null;
  }
  return null;
}

/**
 * Garante a redemption da registration: retorna a existente ou cria uma nova.
 *
 * Usado no caminho de corrida (dois pré-cadastros simultâneos do mesmo
 * documento): o request perdedor do UNIQUE(edition_id, document) acha a
 * registration criada pelo vencedor e precisa devolver o MESMO brinde. Nunca
 * deve responder 500 só porque a redemption ainda não foi criada pelo outro
 * request — este helper fecha essa janela.
 */
export async function ensureRedemption(
  supabase: AdminClient,
  editionId: string,
  registrationId: string
): Promise<Redemption | null> {
  return (
    (await fetchRedemption(supabase, registrationId)) ??
    (await createRedemption(supabase, editionId, registrationId))
  );
}
