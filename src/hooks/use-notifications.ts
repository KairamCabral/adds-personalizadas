"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subscribeToNotifications } from "@/lib/supabase/realtime";
import {
  getNotifications,
  getUnreadCount,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
} from "@/services/notifications.service";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

const NOTIFICATIONS_KEY = ["notifications"];
const UNREAD_COUNT_KEY = ["notifications", "unread"];

export function useNotifications(page = 1, limit = 20) {
  const queryClient = useQueryClient();
  const { profile } = useUser();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, page, limit],
    queryFn: () => getNotifications(page, limit),
    enabled: !!profile?.id,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: getUnreadCount,
    enabled: !!profile?.id,
  });

  const markAsReadMutation = useMutation({
    mutationFn: markAsReadService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllAsReadService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });

  useEffect(() => {
    if (!profile?.id) return;

    const unsubscribe = subscribeToNotifications(profile.id, (payload) => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      const notification = payload.new as { title?: string };
      toast.info(notification?.title ?? "Nova notificação");
    });

    return unsubscribe;
  }, [profile?.id, queryClient]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  };
}
