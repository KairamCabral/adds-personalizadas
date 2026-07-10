import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

/**
 * Geração do crédito de cashback (Épico 6) no pré-cadastro. Server-only (admin
 * client). O crédito é um SNAPSHOT das regras da edição no momento do cadastro
 * — as regras da edição podem mudar depois sem afetar créditos já emitidos.
 * Idempotente: 1 crédito por inscrição (UNIQUE(registration_id) no banco).
 */
type AdminClient = ReturnType<typeof createAdminClient>;
type CashbackType = Database["public"]["Enums"]["event_cashback_type"];
type CashbackEligibility =
  Database["public"]["Enums"]["event_cashback_eligibility"];
type CreditInsert = Database["public"]["Tables"]["event_credits"]["Insert"];

/** Subconjunto da edição necessário para emitir o crédito. */
export interface CashbackConfig {
  id: string;
  cashback_enabled: boolean;
  cashback_type: CashbackType | null;
  cashback_value: number | null;
  cashback_min_order_value: number | null;
  cashback_min_order_qty: number | null;
  cashback_eligibility: CashbackEligibility | null;
  cashback_valid_days: number | null;
}

export interface CreditContext {
  isExistingClient: boolean;
  matchedClientId: string | null;
}

/**
 * Elegibilidade (pura): cashback ligado, config completa (type+value) e a regra
 * de elegibilidade da edição — `NEW_ONLY` só para quem NÃO é cliente existente;
 * `ALL` (ou ausente) para todos.
 */
export function isCashbackEligible(
  cfg: CashbackConfig,
  isExistingClient: boolean
): boolean {
  if (!cfg.cashback_enabled) return false;
  if (cfg.cashback_type == null || cfg.cashback_value == null) return false;
  if (cfg.cashback_eligibility === "NEW_ONLY") return !isExistingClient;
  return true;
}

/** `now + days` como data `YYYY-MM-DD` (coluna date). null se sem validade. */
export function creditValidUntil(now: Date, validDays: number | null): string | null {
  if (validDays == null) return null;
  const d = new Date(now.getTime() + validDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Snapshot (puro) do crédito a inserir. `now` injetado para testabilidade. */
export function buildCreditSnapshot(
  cfg: CashbackConfig,
  registrationId: string,
  ctx: CreditContext,
  now: Date
): CreditInsert {
  return {
    registration_id: registrationId,
    edition_id: cfg.id,
    client_id: ctx.matchedClientId,
    type: cfg.cashback_type as CashbackType,
    value: cfg.cashback_value as number,
    min_order_value: cfg.cashback_min_order_value,
    min_order_qty: cfg.cashback_min_order_qty,
    valid_until: creditValidUntil(now, cfg.cashback_valid_days),
    status: "ATIVO",
  };
}

/**
 * Garante o crédito da inscrição: emite se elegível, no-op se não. Idempotente
 * — colisão de UNIQUE(registration_id) (23505) significa que já existe.
 */
export async function ensureCredit(
  supabase: AdminClient,
  edition: CashbackConfig,
  registrationId: string,
  ctx: CreditContext
): Promise<void> {
  if (!isCashbackEligible(edition, ctx.isExistingClient)) return;

  const snapshot = buildCreditSnapshot(edition, registrationId, ctx, new Date());
  const { error } = await supabase.from("event_credits").insert(snapshot);

  if (error && error.code !== "23505") {
    console.error("[congressos/credit] insert:", error);
  }
}
