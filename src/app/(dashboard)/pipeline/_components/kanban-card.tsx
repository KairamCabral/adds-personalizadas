"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, getInitials, generateAvatarColor, formatDate } from "@/lib/utils";
import { LABEL_MAP, type LabelType } from "@/lib/constants";
import {
  AlignLeft,
  Clock,
  AlertTriangle,
  Truck,
  Paperclip,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Order, OrderLabel, Profile } from "@/types/database.types";

type BlingLog = {
  sent_at: string;
  suppliers?: { name?: string } | null;
};

type OrderItem = { product_name: string; quantity: number };
type OrderAttachment = { id: string };

interface KanbanCardProps {
  disabled?: boolean;
  onArchive?: (orderId: string) => void;
  onUnarchive?: (orderId: string) => void;
  order: Order & {
    client_name?: string;
    assigned_user?: Pick<Profile, "full_name" | "avatar_url">;
    created_user?: Pick<Profile, "full_name" | "avatar_url">;
    labels: Pick<OrderLabel, "label">[];
    bling_logs?: BlingLog[];
    items?: OrderItem[];
    attachments?: OrderAttachment[];
  };
  onClick: () => void;
  isDragging?: boolean;
}

export function KanbanCard({ order, onClick, isDragging, disabled, onArchive, onUnarchive }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: order.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isHighPriority = order.priority === "ALTA";
  const isOverdue =
    order.due_date && new Date(order.due_date) < new Date();
  const lastBlingLog = (order.bling_logs ?? []).sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  )[0];

  const archiveAction = onArchive ?? onUnarchive;
  const isUnarchive = !!onUnarchive;

  function handleCardClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-archive-trigger]")) return;
    onClick();
  }

  return (
    <div
      ref={setNodeRef}
      data-kanban-card
      style={style}
      {...(disabled ? {} : { ...attributes, ...listeners })}
      onClick={handleCardClick}
      className={cn(
        "group cursor-pointer rounded-xl border bg-card p-3 shadow-sm transition-all",
        isDragging || isSortableDragging
          ? "rotate-2 scale-105 border-primary/40 shadow-xl shadow-primary/10"
          : "border-border hover:border-primary/20 hover:shadow-md",
        isSortableDragging && "opacity-40",
        isHighPriority && "border-l-2 border-l-red-500"
      )}
    >
      {/* Labels */}
      {order.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {order.labels.map(({ label }) => {
            const config = LABEL_MAP[label as LabelType];
            if (!config) return null;
            return (
              <span
                key={label}
                className={cn(
                  "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                  config.bgColor,
                  config.textColor
                )}
              >
                {config.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Title */}
      <h4 className="text-sm font-medium leading-snug text-foreground">
        {order.title}
      </h4>

      {/* Items summary */}
      {order.items && order.items.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {order.items
            .map((i) => `${i.product_name} (${i.quantity})`)
            .join(" · ")}
        </p>
      )}

      {/* Description indicator */}
      {order.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {order.description}
        </p>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Has description */}
          {order.description && (
            <div className="flex items-center text-muted-foreground/50">
              <AlignLeft className="h-3 w-3" />
            </div>
          )}

          {/* Has logo/attachments */}
          {order.attachments && order.attachments.length > 0 && (
            <div className="flex items-center text-muted-foreground/50">
              <Paperclip className="h-3 w-3" />
            </div>
          )}

          {/* Due date */}
          {order.due_date && (
            <div
              className={cn(
                "flex items-center gap-1 text-[10px]",
                isOverdue
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              <Clock className="h-3 w-3" />
              {formatDate(order.due_date)}
            </div>
          )}

          {/* Priority */}
          {isHighPriority && (
            <div className="flex items-center text-red-500">
              <AlertTriangle className="h-3 w-3" />
            </div>
          )}

          {/* Bling sync indicator */}
          {lastBlingLog && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center text-primary">
                    <Truck className="h-3 w-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Dados enviados a{" "}
                  {(lastBlingLog.suppliers as { name?: string })?.name ?? "Fornecedor"}{" "}
                  em {formatDate(lastBlingLog.sent_at)}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Arquivar/Desarquivar - aparece no hover */}
          {archiveAction && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    data-archive-trigger
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      archiveAction(order.id);
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                    aria-label={isUnarchive ? "Desarquivar" : "Arquivar"}
                  >
                    {isUnarchive ? (
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{isUnarchive ? "Desarquivar" : "Arquivar"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {(order.assigned_user ?? order.created_user) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                      "shadow-[0_0_0_1px_rgba(255,255,255,0.15)_inset]",
                      generateAvatarColor(
                        (order.assigned_user ?? order.created_user)!.full_name
                      )
                    )}
                  >
                    {getInitials(
                      (order.assigned_user ?? order.created_user)!.full_name
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {order.assigned_user
                    ? `Responsável: ${order.assigned_user.full_name}`
                    : `Criado por: ${order.created_user!.full_name}`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
}
