import { formatCurrency } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type CashbackType = Database["public"]["Enums"]["event_cashback_type"];
type CreditStatus = Database["public"]["Enums"]["event_credit_status"];

/**
 * Status "efetivo": um crédito ATIVO cuja validade já passou é mostrado como
 * EXPIRADO mesmo antes do cron flipar o status no banco. `todayIso` = "YYYY-MM-DD".
 */
export function effectiveCreditStatus(
  status: CreditStatus,
  validUntil: string | null,
  todayIso: string
): CreditStatus {
  if (status === "ATIVO" && validUntil && validUntil < todayIso) return "EXPIRADO";
  return status;
}

export function creditStatusLabel(status: CreditStatus): string {
  switch (status) {
    case "ATIVO":
      return "Ativo";
    case "USADO":
      return "Usado";
    case "EXPIRADO":
      return "Expirado";
    case "CANCELADO":
      return "Cancelado";
    default:
      return status;
  }
}

/** "10%" (PERCENT) ou "R$ 50,00" (FIXED). Client-safe (sem imports server). */
export function formatCashbackValue(
  type: CashbackType | null,
  value: number | null
): string {
  if (value == null) return "—";
  return type === "PERCENT" ? `${value}%` : formatCurrency(value);
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" sem conversão de fuso. */
function ptDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : isoDate;
}

/**
 * Frase de cashback para o e-mail de confirmação. Null quando não há crédito
 * ATIVO (aí o e-mail sai inalterado). Pura — usável no server (dispatch).
 */
interface BenefitParams {
  type: CashbackType | null;
  value: number | null;
  min_order_value: number | null;
  valid_until: string | null;
}

/**
 * Frase do benefício para o participante — termo por tipo: PERCENT → "desconto",
 * FIXED → "vale-compras" (mais natural e incentiva comprar). Pura.
 */
export function formatBenefitLabel(
  b: BenefitParams,
  editionName?: string | null
): string | null {
  if (b.value == null) return null;
  const scope = editionName ? `exclusivo do ${editionName}` : "exclusivo do evento";
  let s =
    b.type === "PERCENT"
      ? `${b.value}% de desconto ${scope} nas compras`
      : `${formatCurrency(b.value)} de vale-compras ${scope}`;
  if (b.min_order_value) {
    s += ` (pedido mínimo de ${formatCurrency(b.min_order_value)})`;
  }
  if (b.valid_until) {
    s += `, válido até ${ptDate(b.valid_until)}`;
  }
  return `${s}.`;
}

/** Frase para o e-mail — só quando o crédito está ATIVO. */
export function buildCashbackEmailLabel(
  credit:
    | (BenefitParams & { status?: string | null })
    | null,
  editionName?: string | null
): string | null {
  if (!credit) return null;
  if (credit.status && credit.status !== "ATIVO") return null;
  return formatBenefitLabel(credit, editionName);
}
