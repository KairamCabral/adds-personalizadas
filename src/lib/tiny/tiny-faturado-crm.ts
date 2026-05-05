import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { canMoveToAprovado } from "@/lib/orders/can-move-to-aprovado";

/**
 * Considera o pedido pago no Tiny: situações "Aprovado" (3) ou "Faturado" (1).
 * No fluxo Tiny, "Aprovado" já implica pagamento confirmado (NF gerada
 * automaticamente), e "Faturado" é o estado pós-emissão da NF. Usado para
 * decidir se aplica a label PAGO no CRM e se move CONFIRMACAO/LINK_ENVIADO
 * para APROVADO.
 *
 * Webhooks às vezes enviam o rótulo em minúsculas, com/sem acento, ou apenas
 * a NF anexada (caso "Faturado" implícito).
 */
export function isTinySituacaoPago(situacao: unknown): boolean {
  if (situacao === null || situacao === undefined) return false;
  if (typeof situacao === "number" && Number.isFinite(situacao)) {
    return situacao === 1 || situacao === 3;
  }
  const s = String(situacao).trim();
  if (s === "") return false;
  const n = Number(s);
  if (Number.isFinite(n) && (n === 1 || n === 3)) return true;
  const lower = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return (
    lower === "faturado" ||
    lower === "faturada" ||
    lower === "autorizada" ||
    lower === "aprovado" ||
    lower === "aprovada"
  );
}

/**
 * Detecta especificamente "Faturado" (código 1). Mantido para casos onde
 * o webhook de NotaFiscal identifica o evento explícito de faturamento —
 * para a regra de label PAGO use `isTinySituacaoPago`.
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

/**
 * Situação Tiny: código 6 = entregue (API). Sincronismo só aplica a tag ENTREGUE;
 * não muda a coluna do pedido.
 */
export function isTinySituacaoEntregue(situacao: unknown): boolean {
  if (situacao === null || situacao === undefined) return false;
  if (typeof situacao === "number" && Number.isFinite(situacao)) {
    return situacao === 6;
  }
  const s = String(situacao).trim();
  if (s === "") return false;
  const n = Number(s);
  if (Number.isFinite(n) && n === 6) return true;
  const lower = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return (
    lower === "entregue" ||
    lower === "entrega" ||
    lower === "entregues"
  );
}

/**
 * Marca o pedido como entregue no CRM via etiqueta (idempotente). Não altera status.
 */
export async function applyEntregueCrmFromTiny(
  supabase: SupabaseClient<Database>,
  orderId: string
): Promise<{ tagAdded: boolean }> {
  const { data: existingLabel } = await supabase
    .from("order_labels")
    .select("id")
    .eq("order_id", orderId)
    .eq("label", "ENTREGUE")
    .maybeSingle();

  if (existingLabel) {
    return { tagAdded: false };
  }
  const { error } = await supabase.from("order_labels").insert({
    order_id: orderId,
    label: "ENTREGUE",
  });
  return { tagAdded: !error };
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
 * Pago no CRM (gatilho: Tiny passa para Aprovado ou Faturado):
 * - tag PAGO (idempotente)
 * - remove etiquetas de "aguardando pagamento"
 * - de CONFIRMACAO/LINK_ENVIADO → APROVADO **somente se o gate de arte
 *   permitir** (ver `canMoveToAprovado`). Se o gate bloquear, mantém o
 *   status atual e só aplica o PAGO — o pedido espera o cliente aprovar
 *   a arte (ou alguém marcar `uses_existing_art`).
 * - não muda status quando o pedido já está numa coluna pós-APROVADO
 *
 * Retorna `gateBlocked` quando estava em CONFIRMACAO/LINK_ENVIADO mas o
 * gate de arte bloqueou a transição — útil pra logs e pra que o caller
 * não dispare auto-envio ao Bling (sem arte aprovada não há o que produzir).
 */
export async function applyPagoCrmFromTiny(
  supabase: SupabaseClient<Database>,
  orderId: string,
  orderStatus: string
): Promise<{
  tagAdded: boolean;
  statusMoved: boolean;
  gateBlocked: boolean;
}> {
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
  let gateBlocked = false;
  if (orderStatus === "CONFIRMACAO" || orderStatus === "LINK_ENVIADO") {
    const gate = await canMoveToAprovado(orderId, supabase);
    if (!gate.allowed) {
      gateBlocked = true;
      console.info(
        `[applyPagoCrmFromTiny] gate de arte bloqueou move pra APROVADO ` +
          `(order ${orderId}, motivo=${gate.reason}). PAGO aplicado mas pedido ` +
          `permanece em ${orderStatus} aguardando aprovação de arte.`
      );
    } else {
      const { count, error: countError } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "APROVADO")
        .is("archived_at", null);
      if (countError) {
        throw countError;
      }
      const { error: rpcError } = await (supabase.rpc as any)(
        "move_order_atomic",
        {
          p_order_id: orderId,
          p_new_status: "APROVADO",
          p_new_position: count ?? 0,
        }
      );
      if (!rpcError) statusMoved = true;
    }
  }

  return { tagAdded, statusMoved, gateBlocked };
}
