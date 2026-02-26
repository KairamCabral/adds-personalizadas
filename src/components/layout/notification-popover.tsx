"use client";

import { Bell, Check, Package, MessageSquare, Image, AlertTriangle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRelativeTime } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/database.types";

const NOTIFICATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  order_created: Package,
  comment_added: MessageSquare,
  mention: MessageSquare,
  artwork_approved: Image,
  artwork_adjustment: Image,
  attachment_added: Image,
  status_changed: Package,
  label_changed: Package,
  quote_received: Package,
  system_alert: AlertTriangle,
};

function getNotificationIcon(type: string) {
  const Icon = NOTIFICATION_ICONS[type] ?? Bell;
  return Icon;
}

export function NotificationPopover() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notificações</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => markAllAsRead()}
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[320px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Bell className="mb-2 h-10 w-10 opacity-50" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => markAsRead(notification.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: Notification;
  onMarkAsRead: () => void;
}) {
  const Icon = getNotificationIcon(notification.type);
  const isUnread = !notification.read_at;

  return (
    <button
      type="button"
      className={cn(
        "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
        isUnread && "bg-accent/50"
      )}
      onClick={() => isUnread && onMarkAsRead()}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          isUnread ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", isUnread && "font-medium")}>
          {notification.title}
        </p>
        {notification.message && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {notification.message}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
    </button>
  );
}
