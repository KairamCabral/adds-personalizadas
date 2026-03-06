"use client";

import {
  useSortable,
  defaultAnimateLayoutChanges,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
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

const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args;
  if (wasDragging) return false;
  if (isSorting) return defaultAnimateLayoutChanges(args);
  return true;
};

export function KanbanCard({ order, onClick, isDragging, disabled, onArchive, onUnarchive }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: order.id,
    disabled,
    animateLayoutChanges,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
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
        "group cursor-pointer overflow-visible rounded-xl border bg-card p-3 shadow-sm transition-all",
        isDragging || isSortableDragging
          ? "scale-[1.02] border-primary/30 shadow-lg shadow-primary/5"
          : "border-border hover:border-primary/20 hover:shadow-md",
        isSortableDragging && "opacity-50",
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

      {/* Footer */}
      <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {/* Has description */}
            {order.description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      <AlignLeft className="h-4 w-4" />
                      <span className="text-[10px]">Descrição</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="pointer-events-none">Possui observações/personalização</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Has logo/attachments */}
            {order.attachments && order.attachments.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      <Paperclip className="h-4 w-4" />
                      <span className="text-[10px]">Anexos</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="pointer-events-none">{order.attachments.length} anexo(s)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Due date */}
            {order.due_date && (
              <div
                className={cn(
                  "flex shrink-0 items-center gap-1 text-[10px]",
                  isOverdue
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                <Clock className="h-4 w-4" />
                <span>{formatDate(order.due_date)}</span>
              </div>
            )}

            {/* Priority */}
            {isHighPriority && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex shrink-0 items-center gap-1 text-red-500">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-[10px]">Alta</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="pointer-events-none">Prioridade alta</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Bling sync - compacto, detalhes no tooltip */}
            {lastBlingLog && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex shrink-0 cursor-help items-center gap-1 text-primary">
                      <Truck className="h-4 w-4" />
                      <span className="text-[10px]">Enviado</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] pointer-events-none">
                    <p className="text-xs">
                      Enviado a{" "}
                      {(lastBlingLog.suppliers as { name?: string })?.name ?? "Fornecedor"}{" "}
                      em {formatDate(lastBlingLog.sent_at)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
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
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                    aria-label={isUnarchive ? "Desarquivar" : "Arquivar"}
                  >
                    {isUnarchive ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="pointer-events-none">{isUnarchive ? "Desarquivar" : "Arquivar"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {(order.assigned_user ?? order.created_user) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
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
                <TooltipContent className="pointer-events-none">
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
