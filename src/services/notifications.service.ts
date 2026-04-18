import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types/database.types";

const supabase = createClient();

export type NotificationWithClient = Notification & {
  client_name?: string | null;
  order_id?: string | null;
  quote_id?: string | null;
};

export async function getNotifications(
  page = 1,
  limit = 20
): Promise<NotificationWithClient[]> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  const notifications = (data ?? []) as Notification[];

  const orderIds = new Set<string>();
  const quoteIds = new Set<string>();
  for (const n of notifications) {
    const d = n.data as { order_id?: string; quote_id?: string } | null;
    if (d?.order_id) orderIds.add(d.order_id);
    if (d?.quote_id) quoteIds.add(d.quote_id);
  }

  const [ordersRes, quotesRes] = await Promise.all([
    orderIds.size > 0
      ? supabase
          .from("orders")
          .select("id, client_id, clients(name)")
          .in("id", Array.from(orderIds))
      : Promise.resolve({
          data: [] as {
            id: string;
            client_id: string | null;
            clients: { name: string } | null;
          }[],
          error: null,
        }),
    quoteIds.size > 0
      ? supabase
          .from("public_quotes")
          .select("id, client_name")
          .in("id", Array.from(quoteIds))
      : Promise.resolve({
          data: [] as { id: string; client_name: string | null }[],
          error: null,
        }),
  ]);

  if (ordersRes.error) throw ordersRes.error;
  if (quotesRes.error) throw quotesRes.error;

  const orderToClient = new Map<string, string | null>();
  for (const o of (ordersRes.data ?? []) as Array<{
    id: string;
    clients: { name: string } | null;
  }>) {
    orderToClient.set(o.id, o.clients?.name ?? null);
  }
  const quoteToClient = new Map<string, string | null>();
  for (const q of (quotesRes.data ?? []) as Array<{
    id: string;
    client_name: string | null;
  }>) {
    quoteToClient.set(q.id, q.client_name ?? null);
  }

  return notifications.map((n) => {
    const d = n.data as { order_id?: string; quote_id?: string } | null;
    const orderId = d?.order_id ?? null;
    const quoteId = d?.quote_id ?? null;
    let client_name: string | null = null;
    if (orderId) client_name = orderToClient.get(orderId) ?? null;
    else if (quoteId) client_name = quoteToClient.get(quoteId) ?? null;
    return { ...n, client_name, order_id: orderId, quote_id: quoteId };
  });
}

export async function getUnreadCount() {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

export async function markAsRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function markAllAsRead() {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) throw error;
}

export async function deleteNotification(id: string) {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function clearAllNotifications() {
  // Filtro que atinge todas as linhas (RLS restringe ao user_id do usuário)
  const { error } = await supabase
    .from("notifications")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) throw error;
}
