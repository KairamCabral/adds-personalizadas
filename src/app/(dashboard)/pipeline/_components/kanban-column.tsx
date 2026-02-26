"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import type { StatusConfig } from "@/lib/constants";
import { KanbanCard } from "./kanban-card";
import { Plus, MoreHorizontal } from "lucide-react";
import type { Order, OrderLabel, Profile } from "@/types/database.types";

interface KanbanColumnProps {
  status: StatusConfig;
  canAddOrder?: boolean;
  readOnly?: boolean;
  onArchive?: (orderId: string) => void;
  onUnarchive?: (orderId: string) => void;
  orders: (Order & {
    client_name?: string;
    assigned_user?: Pick<Profile, "full_name" | "avatar_url">;
    created_user?: Pick<Profile, "full_name" | "avatar_url">;
    labels: Pick<OrderLabel, "label">[];
  })[];
  onAddOrder: () => void;
  onOrderClick: (id: string) => void;
  index: number;
}

export function KanbanColumn({
  status,
  orders,
  canAddOrder = true,
  readOnly = false,
  onArchive,
  onUnarchive,
  onAddOrder,
  onOrderClick,
  index,
}: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: status.key,
  });

  const Icon = status.icon;

  return (
    <div
      ref={setNodeRef}
      data-kanban-column
      className={cn(
        "flex h-full w-[280px] min-w-[280px] flex-col rounded-xl bg-primary/5 shadow-sm transition-colors duration-200 cursor-default backdrop-blur-[2px] dark:bg-transparent dark:shadow-none dark:backdrop-blur-none",
        isOver && "bg-primary/5 ring-2 ring-primary/20 ring-inset"
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Column header — contraste legível no fundo azul claro */}
      <div className="mb-2 flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md ring-1 ring-black/[0.08] dark:ring-transparent",
              status.bgColor
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", status.color)} />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {status.shortLabel}
          </h3>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-200/80 px-1.5 text-[10px] font-bold text-slate-700 dark:bg-secondary dark:text-muted-foreground">
            {orders.length}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          {canAddOrder && (
            <button
              onClick={onAddOrder}
              aria-label={`Adicionar pedido em ${status.shortLabel}`}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-secondary hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          <button
            aria-label={`Opções da coluna ${status.shortLabel}`}
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-secondary hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground"
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Colored line */}
      <div className={cn("mx-2 mb-3 h-0.5 rounded-full", status.bgColor)} />

      {/* Cards container */}
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        <SortableContext
          items={orders.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          {orders.map((order) => (
            <KanbanCard
              key={order.id}
              order={order}
              onClick={() => onOrderClick(order.id)}
              disabled={readOnly}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
            />
          ))}
        </SortableContext>

        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 py-8 text-center">
            <p className="text-xs text-muted-foreground/50">
              Nenhum pedido
            </p>
          </div>
        )}
      </div>

      {/* Add card button */}
      {canAddOrder && (
        <button
          onClick={onAddOrder}
          className="mx-2 mb-2 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary dark:border-border dark:text-muted-foreground"
        >
          <Plus className="h-3 w-3" />
          Adicionar pedido
        </button>
      )}
    </div>
  );
}
