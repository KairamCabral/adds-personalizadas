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
  Check,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Order, OrderLabel, Profile } from "@/types/database.types";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { resendToBling, listAssignableProfiles, updateOrderAssignee } from "@/services/orders.service";
import { toast } from "sonner";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

/** Dias corridos desde fromIso (ISO) até hoje; mínimo 0. */
function calendarAgeDays(fromIso: string | null | undefined): number {
  if (!fromIso) return 0;
  try {
    const d = parseISO(fromIso);
    if (Number.isNaN(d.getTime())) return 0;
    return Math.max(0, differenceInCalendarDays(new Date(), d));
  } catch {
    return 0;
  }
}

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
    /** Preenchido por getOrders via RPC order_status_stamps */
    entered_status_at?: string | null;
  };
  onClick: () => void;
  isDragging?: boolean;
}

function OrderAssigneeAvatar({
  order,
}: {
  order: {
    id: string;
    assigned_user?: Pick<Profile, "full_name" | "avatar_url"> | null;
    created_user?: Pick<Profile, "full_name" | "avatar_url"> | null;
  };
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: profiles = [] } = useQuery({
    queryKey: ["assignable-profiles"],
    queryFn: listAssignableProfiles,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (assignedTo: string | null) =>
      updateOrderAssignee(order.id, assignedTo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", order.id] });
      toast.success("Responsável atualizado!");
      setOpen(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar";
      toast.error(msg);
    },
  });

  const currentUser = order.assigned_user ?? order.created_user;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="focus:outline-none"
          aria-label="Alterar responsável"
        >
          {currentUser ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-primary/50 transition-all",
                      generateAvatarColor(currentUser.full_name || "")
                    )}
                  >
                    {getInitials(currentUser.full_name || "")}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {order.assigned_user
                    ? `Responsável: ${order.assigned_user.full_name}`
                    : `Criado por: ${order.created_user?.full_name ?? "?"}`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground cursor-pointer hover:bg-muted-foreground/20 transition-all">
              ?
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-1"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs text-muted-foreground px-2 py-1.5 font-medium">
          Responsável
        </div>
        {profiles.length === 0 && (
          <div className="text-xs text-muted-foreground px-2 py-2">
            Carregando...
          </div>
        )}
        {profiles.map((p) => {
          const isCurrent = order.assigned_user?.full_name === p.full_name;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => mutation.mutate(p.id)}
              disabled={mutation.isPending}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm"
            >
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white shrink-0",
                  generateAvatarColor(p.full_name || "")
                )}
              >
                {getInitials(p.full_name || "")}
              </div>
              <span className="flex-1 text-left truncate">{p.full_name}</span>
              {isCurrent && <Check className="h-3 w-3 shrink-0" />}
            </button>
          );
        })}
        {order.assigned_user && (
          <>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={() => mutation.mutate(null)}
              disabled={mutation.isPending}
              className="w-full px-2 py-1.5 rounded hover:bg-muted text-xs text-muted-foreground text-left"
            >
              Remover responsável
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
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
  const enteredAt = order.entered_status_at ?? order.created_at;
  const daysInStage = calendarAgeDays(enteredAt);
  const daysSinceCreated = calendarAgeDays(order.created_at);
  const createdOlderThan15Days = daysSinceCreated > 15;

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

      {/* Idade na etapa · idade do cadastro — à direita; vermelho se cadastro &gt; 15 dias */}
      <div
        className={cn(
          "mt-1.5 flex w-full items-center justify-end gap-1 text-[10px] tabular-nums leading-none",
          createdOlderThan15Days
            ? "text-destructive"
            : "text-muted-foreground"
        )}
      >
        <Clock
          className={cn(
            "h-3 w-3 shrink-0 opacity-65",
            createdOlderThan15Days && "text-destructive opacity-90"
          )}
          aria-hidden
        />
        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "cursor-default border-b border-dotted",
                  createdOlderThan15Days
                    ? "border-destructive/45"
                    : "border-muted-foreground/35"
                )}
              >
                {daysInStage}d
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Na etapa atual
            </TooltipContent>
          </Tooltip>
          <span
            className={cn(
              "opacity-45",
              createdOlderThan15Days && "text-destructive opacity-70"
            )}
            aria-hidden
          >
            ·
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "cursor-default border-b border-dotted",
                  createdOlderThan15Days
                    ? "border-destructive/45"
                    : "border-muted-foreground/35"
                )}
              >
                {daysSinceCreated}d
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Desde o cadastro
              {createdOlderThan15Days ? " — acima de 15 dias" : ""}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

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
          <OrderAssigneeAvatar order={order} />
        </div>
      </div>
    </div>
  );
}
