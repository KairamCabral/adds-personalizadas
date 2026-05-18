import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { logAction } from "@/services/audit.service";
import type { Order } from "@/types/database.types";
import type { OrderStatus } from "@/lib/constants";

const supabase = createClient();

// ============================================
// QUERIES
// ============================================

export async function getOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      client:clients(id, name, company, logo_url),
      assigned_user:profiles!orders_assigned_to_fkey(id, full_name, avatar_url),
      created_user:profiles!orders_created_by_fkey(id, full_name, avatar_url),
      rep:profiles!orders_rep_id_fkey(id, full_name),
      labels:order_labels(id, label),
      watchers:order_watchers(user_id, profile:profiles(id, full_name, avatar_url)),
      bling_logs:supplier_data_logs(id, sent_at, status, error_message, fields_sent, supplier_id, suppliers(name)),
      items:order_items(product_name, quantity),
      attachments:attachments(id)
    `)
    .is("is_pipeline_managed", true)
    .is("archived_at", null)
    .is("deleted_at", null)
    .order("status", { ascending: true })
    .order("position", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  const orders = data ?? [];
  if (orders.length === 0) return orders;

  const ids = orders.map((o) => o.id);
  const { data: stamps, error: stampsError } = await supabase.rpc(
    "order_status_stamps",
    { p_order_ids: ids }
  );
  if (stampsError) throw stampsError;

  const byId = new Map(
    (stamps ?? []).map((r) => [r.order_id, r.entered_status_at])
  );

  return orders.map((o) => ({
    ...o,
    entered_status_at: byId.get(o.id) ?? o.created_at,
  }));
}

export async function getArchivedOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      client:clients(id, name, company, logo_url),
      assigned_user:profiles!orders_assigned_to_fkey(id, full_name, avatar_url),
      created_user:profiles!orders_created_by_fkey(id, full_name, avatar_url),
      labels:order_labels(id, label),
      items:order_items(product_name, quantity),
      attachments:attachments(id)
    `)
    .not("archived_at", "is", null)
    .is("deleted_at", null)
    .order("archived_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getTrashedOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      client:clients(id, name, company, logo_url),
      assigned_user:profiles!orders_assigned_to_fkey(id, full_name, avatar_url),
      labels:order_labels(id, label),
      items:order_items(product_name, quantity)
    `)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getOrderById(
  id: string,
  supabaseClient?: SupabaseClient<Database>
) {
  const db = supabaseClient ?? supabase;
  const { data, error } = await db
    .from("orders")
    .select(`
      *,
      client:clients(*),
      assigned_user:profiles!orders_assigned_to_fkey(id, full_name, avatar_url, email),
      rep:profiles!orders_rep_id_fkey(id, full_name, email),
      labels:order_labels(id, label, created_at),
      items:order_items(*, product:products(id, name, image_url, available_colors, allows_custom_color)),
      artworks:artworks(*),
      comments:comments(*, user:profiles!comments_user_id_fkey(id, full_name, avatar_url)),
      watchers:order_watchers(user_id, profile:profiles(id, full_name, avatar_url)),
      history:order_history(*, user:profiles(id, full_name))
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function getOrdersByStatus(status: OrderStatus) {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      client:clients(id, name),
      assigned_user:profiles!orders_assigned_to_fkey(id, full_name, avatar_url),
      labels:order_labels(id, label)
    `)
    .eq("status", status)
    .is("is_pipeline_managed", true)
    .is("archived_at", null)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (error) throw error;
  return data;
}

// ============================================
// MUTATIONS
// ============================================

export async function createOrder(
  order: Omit<Order, "id" | "order_number" | "created_at" | "updated_at">
) {
  // Get the max position for the target status
  const { data: maxPos } = await supabase
    .from("orders")
    .select("position")
    .eq("status", order.status)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("orders")
    .insert({ ...order, position })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Item com quantidade por cor: uma linha por (produto, cor) */
export interface CreateOrderItemParams {
  product_id: string;
  product_name: string;
  quantity: number;
  personalization: {
    colors: string[];
    custom_color: string | null;
    notes?: string;
  };
  color?: string | null;
  color_name?: string | null;
  unit_price?: number | null;
  total_price?: number | null;
}

export interface CreateOrderWithItemsParams {
  title: string;
  description: string | null;
  client_id: string;
  status: OrderStatus;
  order_type: "PERSONALIZADO" | "ORCAMENTO_PUBLICO";
  priority: "NORMAL" | "ALTA";
  created_by: string | null;
  /** Itens já expandidos: um por (produto, cor) */
  items: CreateOrderItemParams[];
}

export async function createOrderWithItems(
  params: CreateOrderWithItemsParams
): Promise<Order> {
  const { data: { user } } = await supabase.auth.getUser();
  const createdBy = params.created_by ?? user?.id ?? null;

  const today = new Date().toISOString().split("T")[0];

  const order = await createOrder({
    title: params.title,
    description: params.description,
    client_id: params.client_id,
    status: params.status,
    order_type: params.order_type,
    priority: params.priority,
    start_date: today,
    due_date: null,
    order_date: today,
    assigned_to: null,
    created_by: createdBy,
    tiny_order_id: null,
    tiny_invoice_id: null,
    is_pipeline_managed: true,
    position: 0,
  } as Omit<Order, "id" | "order_number" | "created_at" | "updated_at">);

  for (const item of params.items) {
    const { error } = await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      personalization: item.personalization,
      color: item.color ?? item.personalization.colors?.[0] ?? null,
      color_name: item.color_name ?? null,
      unit_price: item.unit_price ?? null,
      total_price: item.total_price ?? null,
    });

    if (error) throw error;
  }

  if (createdBy) {
    await supabase.from("order_history").insert({
      order_id: order.id,
      user_id: createdBy,
      action: "created",
      new_value: params.status,
    });
  }

  return order as Order;
}

/**
 * Substitui todos os order_items de um pedido de uma vez.
 * Delete + insert garante consistência sem precisar rastrear diff.
 *
 * Concorrência: o UNIQUE INDEX em (order_id, product_id, COALESCE(color, ''))
 * impede dois replacers paralelos de produzirem duplicatas — qualquer cenário
 * de interleaving converge para 3 linhas em vez de 6. Quando a interleaving
 * faz o segundo INSERT chocar com o primeiro, Postgres devolve 23505
 * (unique_violation); tratamos como "outro caller já gravou o mesmo estado"
 * e retornamos sem erro.
 */
export async function replaceOrderItems(
  orderId: string,
  items: CreateOrderItemParams[]
): Promise<void> {
  const { error: delError } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", orderId);
  if (delError) throw delError;

  if (items.length === 0) return;

  const rows = items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    personalization: item.personalization as Json,
    color: item.color ?? item.personalization.colors?.[0] ?? null,
    color_name: item.color_name ?? null,
    unit_price: item.unit_price ?? null,
    total_price: item.total_price ?? null,
  }));

  const { error: insError } = await supabase.from("order_items").insert(rows);
  if (insError) {
    if (insError.code === "23505") {
      console.warn(
        `[orders.service] replaceOrderItems: unique_violation em order=${orderId}. ` +
          `Outro processo concorrente já inseriu o mesmo conjunto; tratando como no-op.`
      );
      return;
    }
    throw insError;
  }
}

export async function updateOrder(id: string, updates: Partial<Order>) {
  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Move pedido para lixeira (soft-delete). Purge automático após 30 dias pelo cron. */
export async function trashOrder(id: string) {
  const { data, error } = await supabase
    .from("orders")
    .update({ deleted_at: new Date().toISOString() } as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Restaura pedido da lixeira de volta ao estado anterior. */
export async function restoreOrder(id: string) {
  const { data, error } = await supabase
    .from("orders")
    .update({ deleted_at: null } as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Exclusão permanente (usada apenas internamente em rollbacks de formulário). */
export async function deleteOrder(id: string) {
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
}

export async function archiveOrder(id: string) {
  const { data, error } = await supabase
    .from("orders")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Cancela um pedido: arquiva + adiciona label PEDIDO_CANCELADO.
 * Reusa archiveOrder e faz INSERT idempotente na tabela order_labels.
 *
 * IMPORTANTE: o valor da label é "PEDIDO_CANCELADO" (com underscore),
 * que é um valor válido do enum label_type no Supabase.
 */
export async function cancelOrder(id: string) {
  const archived = await archiveOrder(id);

  const { data: existing } = await supabase
    .from("order_labels")
    .select("id")
    .eq("order_id", id)
    .eq("label", "PEDIDO_CANCELADO")
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("order_labels").insert({
      order_id: id,
      label: "PEDIDO_CANCELADO",
    });
    if (error) {
      console.error("[cancelOrder] failed to add label:", error);
    }
  }

  return archived;
}

/**
 * Reenvia um pedido para o Bling (chama o endpoint manual /api/bling/sync).
 * Retorna o JSON da resposta — frontend decide como exibir.
 */
export async function resendToBling(params: {
  orderId: string;
  supplierId: string;
}): Promise<{
  success: boolean;
  contactSent?: boolean;
  orderSent?: boolean;
  blingOrderNumber?: number;
  error?: string;
  status: number;
}> {
  const res = await fetch("/api/bling/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: params.orderId,
      supplierId: params.supplierId,
    }),
  });
  const json = await res.json().catch(() => ({}));
  return {
    success: !!json.success,
    contactSent: json.contactSent,
    orderSent: json.orderSent,
    blingOrderNumber: json.blingOrderNumber,
    error: json.error,
    status: res.status,
  };
}

export async function unarchiveOrder(id: string) {
  const { data, error } = await supabase
    .from("orders")
    .update({ archived_at: null })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // Reativar = retomar pedido. Se foi cancelado (manual ou via Tiny), tira a
  // label PEDIDO_CANCELADO para não ficar visualmente confusa. Espelha o que
  // `cancelOrder` aplica e o que `revertCanceladoCrmFromTiny` faz no fluxo Tiny.
  await supabase
    .from("order_labels")
    .delete()
    .eq("order_id", id)
    .eq("label", "PEDIDO_CANCELADO");

  return data;
}

/**
 * Se o pedido saiu de AUTOMATICO para FAZER, ainda sem responsável, atribui ao usuário logado
 * (somente GESTOR ou MASTER). Chamar após o status do pedido já estar FAZER no banco.
 * Usada por `moveOrder` e pelo arraste com `reorderColumn` (kanban sem filtros).
 */
export async function tryAutoAssignOnAutomativoToFazer(
  orderId: string,
  fromStatus: OrderStatus,
  toStatus: OrderStatus
): Promise<void> {
  if (fromStatus !== "AUTOMATICO" || toStatus !== "FAZER") return;

  const { data: row, error: selectError } = await supabase
    .from("orders")
    .select("status, assigned_to")
    .eq("id", orderId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (!row || row.status !== "FAZER" || row.assigned_to) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "GESTOR" && profile?.role !== "MASTER") return;

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      assigned_to: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updateError) throw updateError;
}

/**
 * Erro lançado quando uma transição é bloqueada por um gate de negócio
 * (ex.: arte não aprovada). UI captura pelo `code` e mostra toast adequado.
 */
export class OrderTransitionBlockedError extends Error {
  code: "no_approved_artwork";
  constructor(message: string) {
    super(message);
    this.name = "OrderTransitionBlockedError";
    this.code = "no_approved_artwork";
  }
}

export async function moveOrder(
  orderId: string,
  newStatus: OrderStatus,
  newPosition: number
) {
  // Capturar status ATUAL antes de mover (para decidir auto-atribuição)
  const { data: currentOrder } = await supabase
    .from("orders")
    .select("status, assigned_to")
    .eq("id", orderId)
    .maybeSingle();

  // Gate APROVADO: pedido só sobe pra APROVADO se tiver arte aprovada OU
  // `uses_existing_art=true`. Idem `applyPagoCrmFromTiny` — fonte única
  // de regra em `canMoveToAprovado`. Aplicado só se a transição for *pra*
  // APROVADO; mover de APROVADO pra outro status segue livre.
  if (newStatus === "APROVADO" && currentOrder?.status !== "APROVADO") {
    const { canMoveToAprovado } = await import(
      "@/lib/orders/can-move-to-aprovado"
    );
    const gate = await canMoveToAprovado(orderId, supabase);
    if (!gate.allowed) {
      throw new OrderTransitionBlockedError(
        "Aprove a arte ou marque “Usar arte aprovada anteriormente” na aba Arte antes de avançar para Aprovado."
      );
    }
  }

  // Mover (RPC atômica original)
  const { error } = await (supabase.rpc as any)("move_order_atomic", {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_new_position: newPosition,
  });
  if (error) throw error;

  if (currentOrder) {
    await tryAutoAssignOnAutomativoToFazer(
      orderId,
      currentOrder.status as OrderStatus,
      newStatus
    );
  }

  const { data, error: fetchError } = await supabase
    .from("orders")
    .select("id, status, position, assigned_to")
    .eq("id", orderId)
    .single();
  if (fetchError) throw fetchError;
  return data;
}

/**
 * Atualiza o responsável (assigned_to) de um pedido.
 * Usado pela edição inline no card.
 */
export async function updateOrderAssignee(
  orderId: string,
  assignedTo: string | null
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({
      assigned_to: assignedTo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) throw error;
}

/**
 * Busca lista de profiles que podem ser responsáveis (GESTOR + MASTER).
 */
export async function listAssignableProfiles(): Promise<
  { id: string; full_name: string | null; avatar_url: string | null; role: string }[]
> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role")
    .in("role", ["GESTOR", "MASTER"])
    .order("full_name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function reorderColumn(
  status: OrderStatus,
  orderIds: string[]
) {
  const { error } = await supabase.rpc("reorder_column", {
    p_status: status,
    p_order_ids: orderIds,
  });

  if (error) throw error;
}

// ============================================
// CONTACT
// ============================================

export async function updateOrderContact(
  orderId: string,
  contactName: string | null,
  contactPhone: string | null
) {
  const { error } = await supabase
    .from("orders")
    .update({
      contact_name: contactName?.trim() || null,
      contact_phone: contactPhone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) throw error;
}

// ============================================
// LABELS
// ============================================

export async function addLabel(orderId: string, label: string) {
  const { data, error } = await supabase
    .from("order_labels")
    .insert({ order_id: orderId, label: label as any })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeLabel(labelId: string) {
  const { error } = await supabase
    .from("order_labels")
    .delete()
    .eq("id", labelId);

  if (error) throw error;
}

// ============================================
// COMMENTS
// ============================================

export async function addComment(
  orderId: string,
  content: string,
  mentions: string[] = []
) {
  const { data, error } = await supabase
    .from("comments")
    .insert({
      order_id: orderId,
      content,
      mentions,
      user_id: (await supabase.auth.getUser()).data.user?.id,
    })
    .select(`*, user:profiles!comments_user_id_fkey(id, full_name, avatar_url)`)
    .single();

  if (error) throw error;
  return data;
}

export async function markCommentAsRead(commentId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Usuário não autenticado");

  const readAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("comments")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- read_at/read_by em schema futuro
    .update({ read_at: readAt, read_by: user.id } as any)
    .eq("id", commentId)
    .select()
    .single();

  if (error) throw error;

  await logAction("UPDATE", "comment_marked_read", commentId, undefined, {
    read_by: user.id,
    read_at: readAt,
  });

  return data;
}

export async function markHistoryAsRead(historyId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("order_history_reads")
    .upsert(
      { history_id: historyId, user_id: user.id, read_at: new Date().toISOString() },
      { onConflict: "history_id,user_id" }
    )
    .select()
    .single();

  if (error) throw error;

  await logAction("UPDATE", "history_marked_read", historyId, undefined, {
    read_by: user.id,
    read_at: data.read_at,
  });

  return data;
}

// ============================================
// WATCHERS
// ============================================

export async function addWatcher(orderId: string, userId: string) {
  const { error } = await supabase
    .from("order_watchers")
    .insert({ order_id: orderId, user_id: userId });

  if (error) throw error;
}

export async function removeWatcher(orderId: string, userId: string) {
  const { error } = await supabase
    .from("order_watchers")
    .delete()
    .match({ order_id: orderId, user_id: userId });

  if (error) throw error;
}
