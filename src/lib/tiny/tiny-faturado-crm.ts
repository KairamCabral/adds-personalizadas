import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { canMoveToAprovado } from "@/lib/orders/can-move-to-aprovado";

/**
 * Considera o pedido pago no Tiny: situações "Aprovado" (3) ou "Faturado" (1).
 * No fluxo Tiny, "Aprovado" já implica pagamento confirmado (NF gerada
 * automaticamente), e "Faturado" é o estado pós-emissão da NF. Usado para
 * decidir se aplica a label PAGO no CRM e se move CONFIRMACAO → APROVADO.
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
 * Situação Tiny "Em aberto" (código 0 / 8). É o estado inicial do pedido no
 * Tiny — sem informação de pagamento, sem avanço de produção. O CRM tem
 * etapas internas (AUTOMATICO, AJUSTE, APROVACAO, AGUARDANDO_APROVACAO,
 * ARTE_APROVADA, CONFIRMACAO) que não existem no Tiny, então quando o Tiny
 * ainda está "Em aberto" o re-sync NÃO deve mover a etapa do CRM.
 */
export function isTinySituacaoAberto(situacao: unknown): boolean {
  if (situacao === null || situacao === undefined) return false;
  if (typeof situacao === "number" && Number.isFinite(situacao)) {
    return situacao === 0 || situacao === 8;
  }
  const s = String(situacao).trim();
  if (s === "") return false;
  const n = Number(s);
  if (Number.isFinite(n) && (n === 0 || n === 8)) return true;
  const lower = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return lower === "em aberto" || lower === "aberto";
}

/**
 * Situação Tiny: código 2 = Cancelado (API/webhook). Sincronismo arquiva o
 * pedido no CRM (archived_at + label PEDIDO_CANCELADO) preservando a etapa
 * atual do Kanban — o pedido sai da visão ativa mas continua recuperável via
 * "Desarquivar", voltando pra mesma coluna onde estava.
 */
export function isTinySituacaoCancelado(situacao: unknown): boolean {
  if (situacao === null || situacao === undefined) return false;
  if (typeof situacao === "number" && Number.isFinite(situacao)) {
    return situacao === 2;
  }
  const s = String(situacao).trim();
  if (s === "") return false;
  const n = Number(s);
  if (Number.isFinite(n) && n === 2) return true;
  const lower = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return lower === "cancelado" || lower === "cancelada";
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
 * - de CONFIRMACAO → APROVADO **somente se o gate de arte permitir** (ver
 *   `canMoveToAprovado`). Se o gate bloquear, mantém o status atual e só
 *   aplica o PAGO — o pedido espera o cliente aprovar a arte (ou alguém
 *   marcar `uses_existing_art`).
 * - em qualquer outra etapa (incl. LINK_ENVIADO, AGUARDANDO_APROVACAO,
 *   ARTE_APROVADA, PRODUCAO, etc.), só aplica a tag PAGO — NÃO movimenta.
 *
 * Retorna `gateBlocked` quando estava em CONFIRMACAO mas o gate de arte
 * bloqueou a transição — útil pra logs e pra que o caller não dispare
 * auto-envio ao Bling (sem arte aprovada não há o que produzir).
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
  if (orderStatus === "CONFIRMACAO") {
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

/**
 * Arquiva o pedido no CRM quando o Tiny passa para "Cancelado":
 * - seta `archived_at = NOW()` somente se ainda for null (preserva a data do
 *   1º cancelamento — webhook duplicado é no-op)
 * - adiciona label PEDIDO_CANCELADO (idempotente)
 *
 * Não mexe em `status` — quem chama deve preservar a etapa atual do Kanban
 * para que `unarchive` devolva o pedido à coluna original.
 */
export async function applyCanceladoCrmFromTiny(
  supabase: SupabaseClient<Database>,
  orderId: string
): Promise<{ archivedNow: boolean; tagAdded: boolean }> {
  const { data: current } = await supabase
    .from("orders")
    .select("archived_at")
    .eq("id", orderId)
    .maybeSingle();

  let archivedNow = false;
  if (current && !current.archived_at) {
    const { error: archErr } = await supabase
      .from("orders")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", orderId);
    if (!archErr) archivedNow = true;
  }

  const { data: existingLabel } = await supabase
    .from("order_labels")
    .select("id")
    .eq("order_id", orderId)
    .eq("label", "PEDIDO_CANCELADO")
    .maybeSingle();

  let tagAdded = false;
  if (!existingLabel) {
    const { error: labelErr } = await supabase.from("order_labels").insert({
      order_id: orderId,
      label: "PEDIDO_CANCELADO",
    });
    if (!labelErr) tagAdded = true;
  }

  return { archivedNow, tagAdded };
}

/**
 * Reverte o arquivamento por cancelamento quando o Tiny sai de "Cancelado":
 * - zera `archived_at` (idempotente — só se estava setado)
 * - remove label PEDIDO_CANCELADO (se existir)
 *
 * Chamado pelo re-sync sempre que a situação Tiny atual NÃO for cancelado
 * mas o pedido CRM ainda traz a marca — espelha o que `applyPagoCrmFromTiny`
 * faz limpando labels obsoletas de "aguardando pagamento".
 */
export async function revertCanceladoCrmFromTiny(
  supabase: SupabaseClient<Database>,
  orderId: string
): Promise<{ unarchived: boolean; tagRemoved: boolean }> {
  const { data: current } = await supabase
    .from("orders")
    .select("archived_at")
    .eq("id", orderId)
    .maybeSingle();

  const { data: existingLabel } = await supabase
    .from("order_labels")
    .select("id")
    .eq("order_id", orderId)
    .eq("label", "PEDIDO_CANCELADO")
    .maybeSingle();

  // Só reverte se o pedido carrega a marca de cancelado-via-Tiny. Sem a label
  // não dá pra saber se o `archived_at` veio do Tiny ou de um arquivamento
  // manual feito no CRM — nesse caso não tocamos em nada.
  if (!existingLabel) {
    return { unarchived: false, tagRemoved: false };
  }

  let unarchived = false;
  if (current?.archived_at) {
    const { error: unarchErr } = await supabase
      .from("orders")
      .update({ archived_at: null })
      .eq("id", orderId);
    if (!unarchErr) unarchived = true;
  }

  const { error: labelErr } = await supabase
    .from("order_labels")
    .delete()
    .eq("order_id", orderId)
    .eq("label", "PEDIDO_CANCELADO");

  return { unarchived, tagRemoved: !labelErr };
}
