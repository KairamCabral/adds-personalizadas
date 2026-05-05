import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Gate de transição pra APROVADO.
 *
 * Pedido só pode subir pra APROVADO se:
 *  1) `orders.uses_existing_art = true` — flag explícita "cliente recorrente,
 *     arte já validada, não precisa aprovação"; OU
 *  2) existir ao menos 1 artwork com status APROVADA neste pedido.
 *
 * Pedido com 0 artes E `uses_existing_art = false` → NÃO pode subir. Isso
 * cobre o bug de webhook PAGO movendo pra APROVADO antes do cliente aprovar
 * a arte.
 *
 * Lógica pura em `canMoveToAprovadoFromState` (testável sem DB) +
 * wrapper `canMoveToAprovado` que faz as queries.
 */

export type AprovadoGateState = {
  uses_existing_art: boolean;
  approved_artwork_count: number;
};

export type AprovadoGateResult =
  | { allowed: true }
  | { allowed: false; reason: "no_approved_artwork_and_no_override" };

/** Decisão pura — separa I/O do core pra teste isolado. */
export function canMoveToAprovadoFromState(
  state: AprovadoGateState
): AprovadoGateResult {
  if (state.uses_existing_art) return { allowed: true };
  if (state.approved_artwork_count > 0) return { allowed: true };
  return { allowed: false, reason: "no_approved_artwork_and_no_override" };
}

/** Wrapper com I/O — busca o estado no DB e roda a decisão pura. */
export async function canMoveToAprovado(
  orderId: string,
  supabase: SupabaseClient<Database>
): Promise<AprovadoGateResult> {
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("uses_existing_art")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    // Pedido não encontrado: bloqueia por segurança. Quem chama trata.
    return { allowed: false, reason: "no_approved_artwork_and_no_override" };
  }

  const { count: approvedCount } = await supabase
    .from("artworks")
    .select("*", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("status", "APROVADA");

  return canMoveToAprovadoFromState({
    uses_existing_art: order.uses_existing_art ?? false,
    approved_artwork_count: approvedCount ?? 0,
  });
}
