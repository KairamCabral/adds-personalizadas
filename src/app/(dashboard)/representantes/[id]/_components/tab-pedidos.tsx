"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Sparkles, Percent } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRepOrders } from "@/services/representantes.service";
import { STATUS_MAP, type OrderStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function generateMonthOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  const options: Array<{ value: string; label: string }> = [{ value: "all", label: "Todos os meses" }];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    options.push({
      value: `${year}-${month}`,
      label: `${MONTH_NAMES[d.getMonth()]}/${year}`,
    });
  }
  return options;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

// -------------------------------------------------------
// Main component
// -------------------------------------------------------

interface TabPedidosProps {
  repId: string;
  repName: string;
}

export function TabPedidos({ repId, repName }: TabPedidosProps) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [monthFilter, setMonthFilter] = useState(defaultMonth);

  const activeMonthFilter = monthFilter === "all" ? undefined : monthFilter;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["rep-orders", repId, activeMonthFilter],
    queryFn: () => getRepOrders(repId, activeMonthFilter),
    staleTime: 2 * 60 * 1000,
  });

  const monthOptions = generateMonthOptions();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold">Pedidos de {repName}</h2>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <ShoppingBag className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Nenhum pedido encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            {activeMonthFilter
              ? "Tente outro filtro de mês."
              : "Nenhum pedido associado a este representante."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold w-16">#</TableHead>
                <TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Extras</TableHead>
                <TableHead className="font-semibold w-20 text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const statusConfig = STATUS_MAP[order.status as OrderStatus];
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      #{order.order_number}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium leading-tight">
                        {order.client_name ?? order.title}
                      </p>
                    </TableCell>
                    <TableCell>
                      {statusConfig ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                            statusConfig.bgColor,
                            statusConfig.color
                          )}
                        >
                          <span
                            className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusConfig.dotColor)}
                          />
                          {statusConfig.shortLabel}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{order.status}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {order.is_personalized && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            <Sparkles className="h-2.5 w-2.5" />
                            Personalizado
                          </span>
                        )}
                        {order.discount_percentage && order.discount_percentage > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            <Percent className="h-2.5 w-2.5" />
                            {order.discount_percentage}%
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                      {formatDate(order.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && orders.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {orders.length} pedido{orders.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
