import { createClient } from "./client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function subscribeToKanban(
  onOrderChange: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new: Record<string, any>;
    old: Record<string, any>;
  }) => void
): () => void {
  const supabase = createClient();

  const channel: RealtimeChannel = supabase
    .channel("kanban-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
      },
      (payload) =>
        onOrderChange({
          eventType: payload.eventType as any,
          new: payload.new,
          old: payload.old,
        })
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "order_labels",
      },
      (payload) =>
        onOrderChange({
          eventType: payload.eventType as any,
          new: payload.new,
          old: payload.old,
        })
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToNotifications(
  userId: string,
  onNotification: (payload: {
    eventType: "INSERT";
    new: Record<string, any>;
  }) => void
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`user-notifications-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) =>
        onNotification({
          eventType: "INSERT",
          new: payload.new,
        })
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToComments(
  orderId: string,
  onComment: (payload: { new: Record<string, any> }) => void
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`order-comments-${orderId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "comments",
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => onComment({ new: payload.new })
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
