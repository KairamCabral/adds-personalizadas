"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryState, parseAsString } from "nuqs";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KANBAN_COLUMN_STATUSES, type OrderStatus } from "@/lib/constants";
import { useUIStore } from "@/stores/ui.store";
import { usePermissions } from "@/hooks/use-permissions";
import { useKanbanRealtime } from "@/hooks/use-kanban-realtime";
import {
  getOrders,
  getArchivedOrders,
  moveOrder,
  reorderColumn,
  archiveOrder,
  unarchiveOrder,
  cancelOrder,
} from "@/services/orders.service";
import { ArchiveCancelDialog } from "@/components/pipeline/archive-cancel-dialog";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { KanbanCardSkeleton } from "./kanban-card-skeleton";
import { OrderDetailSheet } from "./order-detail-sheet";
import { OrderForm } from "./order-form";
import { OrderFilters } from "./order-filters";
import { Button } from "@/components/ui/button";
import { Plus, Search, Archive, LayoutGrid, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Mesma regra de getOrdersByStatus: position e desempate por id (evita ordem diferente do RPC quando há empate). */
function sortOrdersByPositionThenId(
  a: { position?: number; id: string },
  b: { position?: number; id: string }
) {
  const dp = (a.position ?? 0) - (b.position ?? 0);
  if (dp !== 0) return dp;
  return String(a.id).localeCompare(String(b.id));
}

export function KanbanBoard() {
  const {
    selectedOrderId,
    setSelectedOrderId,
    createOrderOpen,
    setCreateOrderOpen,
    createOrderStatus,
    setCreateOrderStatus,
  } = useUIStore();
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  useKanbanRealtime();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ lastX: number } | null>(null);
  const dragOriginStatus = useRef<string | null>(null);
  const isDragLocked = useRef(false);
  const ordersListVersion = useRef(0);
  const blingSyncingRef = useRef(new Set<string>());

  /** Envio automático ao Bling quando o pedido entra em APROVADO (reutilizado por move e reorder). */
  const runBlingSyncForAprovadoOrder = useCallback(
    async (orderId: string) => {
      if (blingSyncingRef.current.has(orderId)) return;
      blingSyncingRef.current.add(orderId);
      try {
        const res = await fetch("/api/bling/sync-on-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, newStatus: "APROVADO" }),
        });
        const json = await res.json().catch(() => ({}));

        const results = (json.results ?? []) as Array<{
          supplierId: string;
          supplierName: string;
          success: boolean;
          error?: string;
          contactSent?: boolean;
          orderSent?: boolean;
          blingOrderNumber?: number;
        }>;

        const anySuccess = results.some((r) => r.success);
        const anyError = results.some((r) => !r.success);

        if (anySuccess && !anyError) {
          toast.success("Pedido enviado ao fornecedor automaticamente.");
        } else if (anySuccess && anyError) {
          const erroredSupplier = results.find((r) => !r.success);
          toast.warning("Envio parcial ao fornecedor", {
            description: erroredSupplier?.error
              ? `${erroredSupplier.supplierName}: ${erroredSupplier.error.slice(0, 120)}`
              : "Veja detalhes no card",
          });
        } else if (anyError) {
          const failed = results.find((r) => !r.success);
          const errorMsg =
            failed?.error ?? `Falha ao enviar ao fornecedor (HTTP ${res.status})`;
          toast.error("Erro ao enviar ao fornecedor", {
            description: errorMsg.slice(0, 200),
            action: failed?.supplierId
              ? {
                  label: "Tentar novamente",
                  onClick: async () => {
                    const retry = await fetch("/api/bling/sync", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        orderId,
                        supplierId: failed.supplierId,
                      }),
                    });
                    const retryJson = await retry.json().catch(() => ({}));
                    queryClient.invalidateQueries({ queryKey: ["orders"] });
                    if (retryJson.success) {
                      toast.success("Reenvio bem-sucedido");
                    } else {
                      toast.error("Reenvio também falhou", {
                        description: (retryJson.error as string) ?? `HTTP ${retry.status}`,
                      });
                    }
                  },
                }
              : undefined,
          });
        }
      } catch (err) {
        console.error("[bling-sync-on-status]", err);
        toast.error("Falha ao contatar o fornecedor", {
          description: "Verifique sua conexão e tente novamente.",
        });
      } finally {
        blingSyncingRef.current.delete(orderId);
      }
    },
    [queryClient]
  );

  const [busca, setBusca] = useQueryState("busca", parseAsString);
  const [responsavel, setResponsavel] = useQueryState("responsavel", parseAsString);
  const [prioridade, setPrioridade] = useQueryState("prioridade", parseAsString);
  const [tipo, setTipo] = useQueryState("tipo", parseAsString);
  const [etiqueta, setEtiqueta] = useQueryState("etiqueta", parseAsString);
  const [orderParam, setOrderParam] = useQueryState("order", parseAsString);
  const [archiveCancelTarget, setArchiveCancelTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordersQuery = useQuery<any[], Error>({
    queryKey: showArchived ? ["archived-orders"] : ["orders"],
    queryFn: async () => {
      if (showArchived) {
        return getArchivedOrders();
      }
      const versionAtStart = ordersListVersion.current;
      const data = await getOrders();
      if (versionAtStart !== ordersListVersion.current) {
        const cur = queryClient.getQueryData<any[]>(["orders"]);
        if (Array.isArray(cur)) return cur;
      }
      return data ?? [];
    },
  });
  const orders = ordersQuery.data ?? [];
  const { isLoading, error } = ordersQuery;

  const archiveMutation = useMutation({
    mutationFn: (orderId: string) => archiveOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["archived-orders"] });
      toast.success("Pedido arquivado.");
      setArchiveCancelTarget(null);
    },
    onError: () => {
      toast.error("Erro ao arquivar pedido.");
      setArchiveCancelTarget(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["archived-orders"] });
      toast.success("Pedido cancelado.");
      setArchiveCancelTarget(null);
    },
    onError: () => {
      toast.error("Erro ao cancelar pedido.");
      setArchiveCancelTarget(null);
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: (orderId: string) => unarchiveOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["archived-orders"] });
      toast.success("Pedido desarquivado.");
    },
    onError: () => toast.error("Erro ao desarquivar pedido."),
  });

  const moveMutation = useMutation({
    mutationFn: async ({
      orderId,
      newStatus,
      newPosition,
    }: {
      orderId: string;
      newStatus: OrderStatus;
      newPosition: number;
    }) => {
      const result = await moveOrder(orderId, newStatus, newPosition);
      return { result, orderId, newStatus };
    },

    onMutate: async ({ orderId, newStatus, newPosition }) => {
      ordersListVersion.current += 1;
      await queryClient.cancelQueries({ queryKey: ["orders"] });

      const previousOrders = queryClient.getQueryData(["orders"]);

      queryClient.setQueryData(["orders"], (old: any) => {
        if (!Array.isArray(old)) return old;

        const movedOrder = old.find((o: any) => o.id === orderId);
        if (!movedOrder) return old;

        const oldStatus = movedOrder.status;
        const withoutMoved = old.filter((o: any) => o.id !== orderId);

        // Recalcular posições da coluna destino
        const targetCards = withoutMoved
          .filter((o: any) => o.status === newStatus)
          .sort(sortOrdersByPositionThenId);

        targetCards.splice(newPosition, 0, {
          ...movedOrder,
          status: newStatus,
          position: newPosition,
        });

        const updatedTarget = targetCards.map((o: any, i: number) => ({
          ...o,
          position: i,
        }));

        // Se mudou de coluna, recalcular posições da coluna de origem
        let otherCards = withoutMoved.filter((o: any) => o.status !== newStatus);
        if (oldStatus !== newStatus) {
          const oldColumnCards = otherCards
            .filter((o: any) => o.status === oldStatus)
            .sort(sortOrdersByPositionThenId)
            .map((o: any, i: number) => ({ ...o, position: i }));
          otherCards = [
            ...otherCards.filter((o: any) => o.status !== oldStatus),
            ...oldColumnCards,
          ];
        }

        return [...otherCards, ...updatedTarget];
      });

      return { previousOrders };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(["orders"], context.previousOrders);
      }
      toast.error("Erro ao mover pedido");
    },

    onSuccess: async (data) => {
      // Refetch completo: aplicar só o card movido quebraria o sort se o RPC usar positions esparsas.
      await queryClient.invalidateQueries({ queryKey: ["orders"] });

      if (data.newStatus === "APROVADO") {
        await runBlingSyncForAprovadoOrder(data.orderId);
      }
    },

    onSettled: () => {
      isDragLocked.current = false;
    },
  });

  /** Reordena pelo array completo de ids (0..n-1 no DB) — evita move_order_atomic com coluna esparsa. */
  const reorderKanbanMutation = useMutation({
    mutationFn: async (vars: {
      sourceStatus: OrderStatus;
      sourceOrderIds: string[];
      destStatus: OrderStatus;
      destOrderIds: string[];
      /** Pedido que entrou em APROVADO (arraste sem filtros) — dispara sync Bling no onSuccess. */
      blingSyncOrderId?: string;
    }) => {
      if (vars.sourceStatus === vars.destStatus) {
        await reorderColumn(vars.destStatus, vars.destOrderIds);
        return;
      }
      if (vars.sourceOrderIds.length > 0) {
        await reorderColumn(vars.sourceStatus, vars.sourceOrderIds);
      }
      await reorderColumn(vars.destStatus, vars.destOrderIds);
    },
    onMutate: async (vars) => {
      ordersListVersion.current += 1;
      await queryClient.cancelQueries({ queryKey: ["orders"] });
      const previousOrders = queryClient.getQueryData(["orders"]);
      const { sourceStatus, sourceOrderIds, destStatus, destOrderIds } = vars;
      const sPos = new Map(sourceOrderIds.map((id, i) => [id, i]));
      const dPos = new Map(destOrderIds.map((id, i) => [id, i]));
      queryClient.setQueryData(["orders"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((o: any) => {
          if (destOrderIds.includes(o.id)) {
            return { ...o, status: destStatus, position: dPos.get(o.id)! };
          }
          if (sourceOrderIds.includes(o.id)) {
            return { ...o, status: sourceStatus, position: sPos.get(o.id)! };
          }
          return o;
        });
      });
      return { previousOrders };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(["orders"], context.previousOrders);
      }
      toast.error("Erro ao reordenar pedidos");
    },
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (
        vars.blingSyncOrderId &&
        vars.destStatus === "APROVADO" &&
        vars.sourceStatus !== "APROVADO"
      ) {
        await runBlingSyncForAprovadoOrder(vars.blingSyncOrderId);
      }
    },
    onSettled: () => {
      isDragLocked.current = false;
    },
  });

  useEffect(() => {
    if (orderParam) {
      setSelectedOrderId(orderParam);
      setOrderParam(null); // Limpar da URL depois de abrir
    }
  }, [orderParam, setSelectedOrderId, setOrderParam]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const visibleColumns = KANBAN_COLUMN_STATUSES;

  const handlePanStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("[data-kanban-card]")) return;
      const el = scrollRef.current;
      if (!el) return;
      panRef.current = { lastX: e.clientX };
      setIsPanning(true);
    },
    []
  );

  useEffect(() => {
    if (!isPanning) return;
    const el = scrollRef.current;
    if (!el) return;

    const handleMove = (e: MouseEvent) => {
      const pan = panRef.current;
      if (!pan) return;
      const dx = pan.lastX - e.clientX;
      el.scrollLeft += dx;
      pan.lastX = e.clientX;
    };

    const handleEnd = () => {
      panRef.current = null;
      setIsPanning(false);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("mouseleave", handleEnd);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("mouseleave", handleEnd);
    };
  }, [isPanning]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.shiftKey) return;
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }, []);

  const getOrdersByStatus = useCallback(
    (status: OrderStatus) => {
      return (orders as any[])
        .filter((o: any) => o.status === status)
        .filter((o: any) => {
          if (responsavel) {
            const isAssigned = o.assigned_to === responsavel;
            const isCreator = o.created_by === responsavel;
            if (!isAssigned && !isCreator) return false;
          }
          if (prioridade && o.priority !== prioridade) return false;
          if (tipo && o.order_type !== tipo) return false;
          if (etiqueta) {
            const labels = o.labels ?? [];
            const hasLabel = labels.some((l: { label: string }) => l.label === etiqueta);
            if (!hasLabel) return false;
          }
          if (busca?.trim()) {
            const q = busca.trim().toLowerCase();
            const title = (o.title ?? "").toLowerCase();
            const clientName = (o.client?.name ?? "").toLowerCase();
            const clientCompany = (o.client?.company ?? "").toLowerCase();
            if (!title.includes(q) && !clientName.includes(q) && !clientCompany.includes(q)) {
              return false;
            }
          }
          return true;
        })
        .sort((a: any, b: any) => {
          const dp = (a.position ?? 0) - (b.position ?? 0);
          if (dp !== 0) return dp;
          return String(a.id).localeCompare(String(b.id));
        });
    },
    [orders, busca, responsavel, prioridade, tipo, etiqueta]
  );

  function handleDragStart(event: DragStartEvent) {
    if (isDragLocked.current || moveMutation.isPending || reorderKanbanMutation.isPending) {
      return;
    }
    setActiveId(event.active.id as string);
    const order = (orders as any[]).find((o: any) => o.id === event.active.id);
    dragOriginStatus.current = order?.status ?? null;
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) {
      setDragOverColumnId(null);
      return;
    }
    const overColumnId = over.data.current?.sortable?.containerId ?? over.id;
    const isColumn = visibleColumns.some((s) => s.key === overColumnId);
    setDragOverColumnId(isColumn ? (overColumnId as string) : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const originalStatus = dragOriginStatus.current;

    setDragOverColumnId(null);
    dragOriginStatus.current = null;

    const clearDrag = () => setActiveId(null);

    if (isDragLocked.current || moveMutation.isPending || reorderKanbanMutation.isPending) {
      clearDrag();
      return;
    }

    if (showArchived || !over || !originalStatus) {
      clearDrag();
      return;
    }

    const overOrder = (orders as any[]).find((o: any) => o.id === over.id);
    const overColumnId = over.data.current?.sortable?.containerId ?? over.id;
    const targetStatus =
      (visibleColumns.some((s) => s.key === overColumnId) ? overColumnId : null) ??
      overOrder?.status;

    if (!targetStatus) {
      clearDrag();
      return;
    }

    if (targetStatus === "ARQUIVADO") {
      if (can("orders.archive")) {
        archiveMutation.mutate(active.id as string);
      }
      clearDrag();
      return;
    }

    const isSameColumn = originalStatus === targetStatus;
    const activeIdStr = active.id as string;
    const overIdStr = String(over.id);

    const noKanbanFilters =
      !busca?.trim() && !responsavel && !prioridade && !tipo && !etiqueta;

    const targetOrders = (orders as any[])
      .filter((o: any) => o.id !== active.id && o.status === targetStatus)
      .sort(sortOrdersByPositionThenId);

    const fullSortedExcludingActive = (orders as any[])
      .filter((o: any) => o.id !== active.id && o.status === targetStatus)
      .sort(sortOrdersByPositionThenId);

    let newPosition: number;

    if (isSameColumn) {
      const visibleIds = getOrdersByStatus(targetStatus).map((o) => o.id);
      const oldIndex = visibleIds.indexOf(activeIdStr);
      if (oldIndex === -1) {
        clearDrag();
        return;
      }

      const droppedOnColumnOnly = visibleColumns.some((s) => s.key === overIdStr);
      let newIndex: number;
      if (droppedOnColumnOnly) {
        newIndex = visibleIds.length - 1;
      } else if (visibleIds.includes(overIdStr)) {
        newIndex = visibleIds.indexOf(overIdStr);
      } else {
        newIndex = visibleIds.length - 1;
      }

      if (oldIndex === newIndex) {
        clearDrag();
        return;
      }

      const reordered = arrayMove(visibleIds, oldIndex, newIndex);
      const rankInVisible = reordered.indexOf(activeIdStr);

      const allVisible =
        visibleIds.length === fullSortedExcludingActive.length + 1;

      if (allVisible && noKanbanFilters) {
        isDragLocked.current = true;
        reorderKanbanMutation.mutate({
          sourceStatus: targetStatus as OrderStatus,
          sourceOrderIds: reordered,
          destStatus: targetStatus as OrderStatus,
          destOrderIds: reordered,
        });
        clearDrag();
        return;
      }

      if (allVisible) {
        newPosition = rankInVisible;
      } else {
        const predId = rankInVisible > 0 ? reordered[rankInVisible - 1] : null;
        const succId =
          rankInVisible < reordered.length - 1 ? reordered[rankInVisible + 1] : null;

        if (predId && succId) {
          const succ = fullSortedExcludingActive.find((o: any) => o.id === succId);
          newPosition = succ ? Number(succ.position) : rankInVisible;
        } else if (!predId && succId) {
          const succ = fullSortedExcludingActive.find((o: any) => o.id === succId);
          newPosition = succ ? Number(succ.position) : 0;
        } else if (predId && !succId) {
          const pred = fullSortedExcludingActive.find((o: any) => o.id === predId);
          newPosition = pred ? Number(pred.position) + 1 : fullSortedExcludingActive.length;
        } else {
          newPosition = 0;
        }
      }
    } else {
      newPosition = targetOrders.length;
    }

    const maxPos = isSameColumn ? fullSortedExcludingActive.length : targetOrders.length;
    newPosition = Math.max(0, Math.min(newPosition, maxPos));

    if (!isSameColumn && noKanbanFilters) {
      const sourceOrderIds = (orders as any[])
        .filter((o: any) => o.id !== activeIdStr && o.status === originalStatus)
        .sort(sortOrdersByPositionThenId)
        .map((o: any) => o.id);
      const destOrderIds = [...targetOrders.map((o: any) => o.id), activeIdStr];
      isDragLocked.current = true;
      reorderKanbanMutation.mutate({
        sourceStatus: originalStatus as OrderStatus,
        sourceOrderIds,
        destStatus: targetStatus as OrderStatus,
        destOrderIds,
        blingSyncOrderId:
          targetStatus === "APROVADO" && originalStatus !== "APROVADO"
            ? activeIdStr
            : undefined,
      });
      clearDrag();
      return;
    }

    isDragLocked.current = true;

    moveMutation.mutate({
      orderId: activeIdStr,
      newStatus: targetStatus as OrderStatus,
      newPosition,
    });
    clearDrag();
  }

  function handleAddOrder(status: OrderStatus) {
    setCreateOrderStatus(status);
    setCreateOrderOpen(true);
  }

  const activeOrder = activeId
    ? (orders as any[]).find((o: any) => o.id === activeId)
    : null;

  const filteredCount = visibleColumns.reduce(
    (acc, s) => acc + getOrdersByStatus(s.key).length,
    0
  );
  const hasActiveFilters = !!busca || !!responsavel || !!prioridade || !!tipo || !!etiqueta;

  const clearPipelineFilters = () => {
    void setBusca(null);
    void setResponsavel(null);
    void setPrioridade(null);
    void setTipo(null);
    void setEtiqueta(null);
  };

  return (
    <div className="flex h-[calc(100vh-60px)] flex-col">
      {/* Toolbar — azul claro só no tema claro; tema escuro inalterado */}
      <div className="flex items-center justify-between border-b border-border bg-primary/10 px-6 py-3 dark:bg-background">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">
            {showArchived ? "Arquivados" : "Pipeline"}
          </h1>
          <div className="flex h-6 items-center rounded-full bg-primary/10 px-2.5">
            <span className="text-xs font-semibold text-primary">
              {hasActiveFilters ? filteredCount : (orders as any[]).length}{" "}
              {showArchived ? "arquivados" : "pedidos"}
              {hasActiveFilters && ` de ${(orders as any[]).length}`}
            </span>
          </div>
          {can("orders.archive") && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
                showArchived
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {showArchived ? (
                <>
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Ver ativos
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5" />
                  Ver arquivados
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label="Buscar por cliente"
              placeholder="Buscar por cliente..."
              value={busca ?? ""}
              onChange={(e) => setBusca(e.target.value || null)}
              className="h-8 w-52 rounded-lg border border-border bg-secondary/50 pl-8 pr-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/30 focus:bg-card"
            />
          </div>

          <OrderFilters />

          {hasActiveFilters && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 shrink-0 gap-1.5 px-3 text-xs font-semibold shadow-sm"
              onClick={clearPipelineFilters}
              aria-label="Limpar todos os filtros do pipeline"
            >
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Limpar filtros
            </Button>
          )}

          {can("orders.create") && !showArchived && (
            <button
              onClick={() => {
                setCreateOrderStatus("FAZER");
                setCreateOrderOpen(true);
              }}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Pedido
            </button>
          )}
        </div>
      </div>

      {/* Kanban board — azul claro só no tema claro; tema escuro inalterado */}
      <div
        ref={scrollRef}
        role="region"
        aria-label="Área do kanban"
        onMouseDown={handlePanStart}
        onWheel={handleWheel}
        className={cn(
          "kanban-scroll flex-1 overflow-x-auto overflow-y-hidden select-none touch-pan-x bg-primary/5 dark:bg-background",
          isPanning ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        {isLoading ? (
          <div className="flex h-full gap-3 p-4">
            {visibleColumns.map((status) => (
              <div
                key={status.key}
                className="flex w-[280px] min-w-[280px] flex-col gap-2 rounded-xl bg-primary/5 p-2 dark:bg-background/80"
              >
                <div className="mb-2 h-8 rounded-md bg-muted/50" />
                <KanbanCardSkeleton />
                <KanbanCardSkeleton />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-foreground">
              Erro ao carregar pedidos. Verifique sua conexão.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full min-w-0 gap-3 p-4 min-h-0">
              {visibleColumns.map((status, index) => (
                <KanbanColumn
                  key={status.key}
                  status={status}
                  orders={getOrdersByStatus(status.key)}
                  isDropTarget={dragOverColumnId === status.key}
                  canAddOrder={can("orders.create") && !showArchived && status.key !== "ARQUIVADO"}
                  onAddOrder={() => handleAddOrder(status.key)}
                  onOrderClick={(id) => setSelectedOrderId(id)}
                  index={index}
                  readOnly={showArchived || !can("orders.change_status")}
                  onArchive={
                    can("orders.archive") && !showArchived
                      ? (id) => {
                          const order = (orders as any[]).find((o: any) => o.id === id);
                          setArchiveCancelTarget({
                            id,
                            title: order?.title ?? "este pedido",
                          });
                        }
                      : undefined
                  }
                  onUnarchive={
                    can("orders.archive") && showArchived
                      ? (id) => unarchiveMutation.mutate(id)
                      : undefined
                  }
                />
              ))}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeId && activeOrder ? (
                <KanbanCard order={activeOrder} onClick={() => {}} disabled />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Order detail sheet */}
      <OrderDetailSheet />

      {/* Order form dialog (wizard de 3 passos) */}
      <OrderForm
        open={createOrderOpen}
        onOpenChange={setCreateOrderOpen}
      />

      <ArchiveCancelDialog
        open={!!archiveCancelTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveCancelTarget(null);
        }}
        orderTitle={archiveCancelTarget?.title}
        onArchive={() =>
          archiveCancelTarget && archiveMutation.mutate(archiveCancelTarget.id)
        }
        onCancel={() =>
          archiveCancelTarget && cancelMutation.mutate(archiveCancelTarget.id)
        }
        loading={archiveMutation.isPending || cancelMutation.isPending}
      />
    </div>
  );
}
