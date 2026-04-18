"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  Package,
  MessageSquare,
  Image,
  AlertTriangle,
  FileText,
  ArrowRight,
  ArrowRightLeft,
  Tag,
  Paperclip,
  AtSign,
  Trash2,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNotifications } from "@/hooks/use-notifications";
import { useUIStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils";
import type { NotificationWithClient } from "@/services/notifications.service";

// ═══════════════════════════════════════
// CONFIG DE TIPOS DE NOTIFICAÇÃO
// ═══════════════════════════════════════
const NOTIFICATION_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  order_created: {
    icon: Package,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Novo pedido",
  },
  status_changed: {
    icon: ArrowRightLeft,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    label: "Status",
  },
  comment_added: {
    icon: MessageSquare,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    label: "Comentário",
  },
  mention: {
    icon: AtSign,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    label: "Menção",
  },
  artwork_approved: {
    icon: Image,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    label: "Arte aprovada",
  },
  artwork_adjustment: {
    icon: Image,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    label: "Ajuste de arte",
  },
  // Retrocompatibilidade: notificações antigas usavam este tipo
  artwork_revision_requested: {
    icon: Image,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    label: "Ajuste de arte",
  },
  attachment_added: {
    icon: Paperclip,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    label: "Anexo",
  },
  label_changed: {
    icon: Tag,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    label: "Etiqueta",
  },
  quote_received: {
    icon: FileText,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    label: "Orçamento",
  },
  system_alert: {
    icon: AlertTriangle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "Sistema",
  },
};

const DEFAULT_CONFIG = {
  icon: Bell,
  color: "text-muted-foreground",
  bgColor: "bg-muted",
  label: "Notificação",
};

// ═══════════════════════════════════════
// AGRUPAR POR TEMPO
// ═══════════════════════════════════════
function groupByTime(notifications: NotificationWithClient[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: NotificationWithClient[] }[] = [
    { label: "Hoje", items: [] },
    { label: "Ontem", items: [] },
    { label: "Esta semana", items: [] },
    { label: "Anteriores", items: [] },
  ];

  for (const n of notifications) {
    const date = new Date(n.created_at);
    if (date >= today) groups[0].items.push(n);
    else if (date >= yesterday) groups[1].items.push(n);
    else if (date >= weekAgo) groups[2].items.push(n);
    else groups[3].items.push(n);
  }

  return groups.filter((g) => g.items.length > 0);
}

// ═══════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════
export function NotificationPopover() {
  const router = useRouter();
  const setSelectedOrderId = useUIStore((s) => s.setSelectedOrderId);
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  const groups = useMemo(() => groupByTime(notifications), [notifications]);
  const [open, setOpen] = useState(false);

  // Clicar na notificação: marcar como lida + navegar + fechar popover
  const handleClick = (notification: NotificationWithClient) => {
    if (!notification.read_at) {
      markAsRead(notification.id);
    }

    if (notification.order_id) {
      setSelectedOrderId(notification.order_id);
      setOpen(false);
      router.push("/pipeline");
    } else if (notification.quote_id) {
      setOpen(false);
      router.push("/quotes");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Notificações</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs tabular-nums">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => markAllAsRead()}
              >
                <Check className="mr-1 h-3 w-3" />
                Marcar lidas
              </Button>
            )}
            {notifications.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Limpar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Limpar todas as notificações?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Todas as suas notificações serão removidas
                      permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        clearAll();
                        setOpen(false);
                      }}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Limpar todas
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Notificações agrupadas */}
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Nenhuma notificação
              </p>
            </div>
          ) : (
            <div>
              {groups.map((group) => (
                <div key={group.label}>
                  {/* Group label */}
                  <div className="sticky top-0 z-10 border-b bg-background/95 px-4 py-1.5 backdrop-blur-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </p>
                  </div>

                  {/* Items */}
                  {group.items.map((notification) => {
                    const config =
                      NOTIFICATION_CONFIG[notification.type] ?? DEFAULT_CONFIG;
                    const Icon = config.icon;
                    const isUnread = !notification.read_at;

                    return (
                      <div
                        key={notification.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleClick(notification)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleClick(notification);
                          }
                        }}
                        className={cn(
                          "group relative flex cursor-pointer gap-3 border-b border-border/50 px-4 py-3 transition-colors",
                          isUnread
                            ? "bg-primary/[0.03] hover:bg-primary/[0.06]"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {(notification.order_id || notification.quote_id) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClick(notification);
                              }}
                              className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                              title="Abrir card"
                              aria-label="Abrir card"
                            >
                              Abrir
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="rounded p-1 hover:bg-muted"
                            title="Remover notificação"
                            aria-label="Remover notificação"
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                        {/* Ícone colorido */}
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            config.bgColor
                          )}
                        >
                          <Icon className={cn("h-4 w-4", config.color)} />
                        </div>

                        {/* Conteúdo */}
                        <div className="min-w-0 flex-1 pr-24">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                "text-sm leading-tight",
                                isUnread ? "font-medium" : "text-muted-foreground"
                              )}
                            >
                              {notification.title}
                            </p>
                            {isUnread && (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                            )}
                          </div>
                          {notification.message && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {notification.message}
                            </p>
                          )}
                          {notification.client_name && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-foreground/80">
                              <span className="text-muted-foreground">Cliente:</span>
                              {notification.client_name}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-muted-foreground/70">
                            {formatDistanceToNow(
                              new Date(notification.created_at),
                              {
                                addSuffix: true,
                                locale: ptBR,
                              }
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
