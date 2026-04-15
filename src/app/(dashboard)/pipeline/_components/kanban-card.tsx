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
  AlertCircle,
  Truck,
  Paperclip,
  Archive,
  ArchiveRestore,
  User,
  Sparkles,
  Percent,
  Smartphone,
  RotateCcw,
  Loader2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Order, OrderLabel, Profile } from "@/types/database.types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resendToBling } from "@/services/orders.service";
import { toast } from "sonner";

type BlingLog = {
  id: string;
  sent_at: string;
  status: "success" | "error" | string;
  error_message: string | null;
  fields_sent: string[];
  supplier_id: string;
  suppliers: { name?: string } | null;
};

type BlingDisplayState =
  | { kind: "none" }
  | { kind: "success"; log: BlingLog }
  | { kind: "partial"; log: BlingLog }
  | { kind: "error"; log: BlingLog };

function deriveBlingState(logs: BlingLog[] | undefined | null): BlingDisplayState {
  if (!logs || logs.length === 0) return { kind: "none" };
  const sorted = [...logs].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  );
  const last = sorted[0];
  if (last.status === "success") return { kind: "success", log: last };
  const fields = last.fields_sent ?? [];
  const sentOrder = fields.includes("bling_order");
  if (!sentOrder) return { kind: "partial", log: last };
  return { kind: "error", log: last };
}

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
    rep?: { full_name: string } | null;
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
  const blingState = deriveBlingState(order.bling_logs as BlingLog[] | undefined);

  const queryClient = useQueryClient();
  const resendMutation = useMutation({
    mutationFn: () => {
      if (blingState.kind !== "error" && blingState.kind !== "partial") {
        throw new Error("Sem log de erro para reenviar");
      }
      return resendToBling({
        orderId: order.id,
        supplierId: blingState.log.supplier_id,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (data.success) {
        toast.success("Reenvio bem-sucedido", {
          description: data.blingOrderNumber
            ? `Pedido Bling #${data.blingOrderNumber} criado`
            : "Pedido enviado ao Bling",
        });
      } else if (data.contactSent && !data.orderSent) {
        toast.warning("Contato enviado, pedido ainda falhou", {
          description: data.error ?? `HTTP ${data.status}`,
        });
      } else {
        toast.error("Reenvio falhou", {
          description: data.error ?? `HTTP ${data.status}`,
        });
      }
    },
    onError: (err: Error) => {
      toast.error("Erro ao reenviar", { description: err.message });
    },
  });

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

      {/* Badges do app de representantes */}
      {((order as any).rep_id || (order as any).is_personalized || (order as any).discount_pending_approval || (order as any).origin === "APP_REPRESENTANTE") && (
        <div className="mb-2 flex flex-wrap gap-1">
          {(order as any).origin === "APP_REPRESENTANTE" && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
              <Smartphone className="h-2.5 w-2.5" />
              App
            </span>
          )}
          {(order as any).rep_id && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              <User className="h-2.5 w-2.5" />
              Rep
            </span>
          )}
          {(order as any).is_personalized && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <Sparkles className="h-2.5 w-2.5" />
              Personalizado
            </span>
          )}
          {(order as any).discount_pending_approval && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <Percent className="h-2.5 w-2.5" />
              {(order as any).discount_percentage ? `${(order as any).discount_percentage}% pendente` : "Desconto pendente"}
            </span>
          )}
        </div>
      )}

      {/* Nome do representante */}
      {order.rep?.full_name && (
        <p className="mb-1 text-[10px] text-muted-foreground">
          Rep: {order.rep.full_name}
        </p>
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
            {blingState.kind === "success" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex shrink-0 cursor-help items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Truck className="h-4 w-4" />
                      <span className="text-[10px] font-medium">Enviado</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] pointer-events-none">
                    <p className="text-xs">
                      Enviado a{" "}
                      {blingState.log.suppliers?.name ?? "Fornecedor"}{" "}
                      em {formatDate(blingState.log.sent_at)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {blingState.kind === "partial" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex shrink-0 cursor-help items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-[10px] font-medium">Parcial</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[300px] pointer-events-none">
                    <p className="text-xs font-medium mb-1">Contato enviado, pedido falhou</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-3">
                      {(blingState.log.error_message ?? "Sem detalhes do erro").slice(0, 200)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {blingState.kind === "error" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex shrink-0 cursor-help items-center gap-1 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-[10px] font-medium">Erro Bling</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[300px] pointer-events-none">
                    <p className="text-xs font-medium mb-1">Erro ao enviar ao fornecedor</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-3">
                      {(blingState.log.error_message ?? "Sem detalhes do erro").slice(0, 200)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {(blingState.kind === "error" || blingState.kind === "partial") && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        resendMutation.mutate();
                      }}
                      disabled={resendMutation.isPending}
                      aria-label="Reenviar ao Bling"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                    >
                      {resendMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="pointer-events-none">
                    <p className="text-xs">Reenviar ao Bling</p>
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
