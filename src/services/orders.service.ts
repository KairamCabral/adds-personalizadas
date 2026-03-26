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
      bling_logs:supplier_data_logs(sent_at, suppliers(name)),
      items:order_items(product_name, quantity),
      attachments:attachments(id)
    `)
    .is("tiny_order_id", null)
    .is("archived_at", null)
    .order("status", { ascending: true })
    .order("position", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return data;
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
    .is("tiny_order_id", null)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

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
    .is("tiny_order_id", null)
    .is("archived_at", null)
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
    position: 0,
  } as Omit<Order, "id" | "order_number" | "created_at" | "updated_at">);

  for (const item of params.items) {
    const { error } = await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      personalization: item.personalization,
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
  }));

  const { error: insError } = await supabase.from("order_items").insert(rows);
  if (insError) throw insError;
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

export async function unarchiveOrder(id: string) {
  const { data, error } = await supabase
    .from("orders")
    .update({ archived_at: null })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function moveOrder(
  orderId: string,
  newStatus: OrderStatus,
  newPosition: number
) {
  const { error } = await (supabase.rpc as any)("move_order_atomic", {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_new_position: newPosition,
  });

  if (error) throw error;

  const { data, error: fetchError } = await supabase
    .from("orders")
    .select("id, status, position")
    .eq("id", orderId)
    .single();

  if (fetchError) throw fetchError;
  return data;
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
