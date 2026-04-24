import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * O Tiny (e o Olist) usam o código 1 para "Faturado" (ver TINY_SITUACAO_MAP no tiny-complete).
 * Webhooks às vezes enviam a palavra em minúsculas ou com acento, ou omitem situação com NF.
 */
export function isTinySituacaoFaturado(situacao: unknown): boolean {
  if (situacao === null || situacao === undefined) return false;
  if (typeof situacao === "number" && Number.isFinite(situacao)) {
    return situacao === 1;
  }
  const s = String(situacao).trim();
  if (s === "") return false;
  const n = Number(s);
  if (Number.isFinite(n) && n === 1) return true;
  const lower = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (lower === "faturado" || lower === "faturada" || lower === "autorizada")
    return true;
  return false;
}

export function notaFiscalIdFromTinyDados(
  dados: Record<string, unknown> | null | undefined
): number | null {
  if (!dados) return null;
  const cands = [
    dados.idNotaFiscal,
    dados.id_nota_fiscal,
    (dados.notaFiscal as Record<string, unknown> | undefined)?.id,
    dados.idNota,
  ];
  for (const c of cands) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function notaFiscalIdFromTinyPedidoRaw(
  raw: Record<string, unknown> | null | undefined
): number | null {
  if (!raw) return null;
  const cands = [
    raw.idNotaFiscal,
    raw.id_nota_fiscal,
    raw.notaFiscal,
    (raw.notaFiscal as Record<string, unknown> | undefined)?.id,
  ];
  for (const c of cands) {
    if (c && typeof c === "object") continue;
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return notaFiscalIdFromTinyDados(raw);
}

/**
 * Faturado no CRM:
 * - tag PAGO (idempotente)
 * - remove etiquetas de "aguardando pagamento"
 * - de CONFIRMACAO (ou LINK_ENVIADO) → APROVADO no fim da coluna (RPC, como no kanban)
 * - não usa coluna FATURADO
 */
export async function applyFaturadoCrmFromTiny(
  supabase: SupabaseClient<Database>,
  orderId: string,
  orderStatus: string
): Promise<{ tagAdded: boolean; statusMoved: boolean }> {
  const { data: existingLabel } = await supabase
    .from("order_labels")
    .select("id")
    .eq("order_id", orderId)
    .eq("label", "PAGO")
    .maybeSingle();

  let tagAdded = false;
  if (!existingLabel) {
    const { error: labelError } = await supabase.from("order_labels").insert({
      order_id: orderId,
      label: "PAGO",
    });
    if (!labelError) tagAdded = true;
  }

  await supabase
    .from("order_labels")
    .delete()
    .eq("order_id", orderId)
    .in("label", ["AGUARDANDO_PAGAMENTO", "APROV_AGUARDANDO_PAGAMENTO"]);

  let statusMoved = false;
  if (orderStatus === "CONFIRMACAO" || orderStatus === "LINK_ENVIADO") {
    const { count, error: countError } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "APROVADO")
      .is("archived_at", null);
    if (countError) {
      throw countError;
    }
    const { error: rpcError } = await (supabase.rpc as any)("move_order_atomic", {
      p_order_id: orderId,
      p_new_status: "APROVADO",
      p_new_position: count ?? 0,
    });
    if (!rpcError) statusMoved = true;
  }

  return { tagAdded, statusMoved };
}
