"use client";

import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "./metric-card";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, ShoppingCart, Package, CheckCircle2, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getVendasData,
  getPeriodRange,
  type PeriodValue,
} from "@/services/dashboard.service";

interface TabVendasProps {
  period: PeriodValue;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  USUARIO: "Usuário",
  PERSONALIZADO: "Personalizado",
  RUSH: "Rush",
  PROMOCIONAL: "Promocional",
  ORCAMENTO_PUBLICO: "Orç. Público",
};

function TabVendasSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

export function TabVendas({ period }: TabVendasProps) {
  const range = getPeriodRange(period);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "vendas", period],
    queryFn: () => getVendasData(range),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <TabVendasSkeleton />;

  if (isError) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed p-16 text-center">
        <p className="text-sm text-destructive">Erro ao carregar dados de vendas.</p>
      </div>
    );
  }

  const isEmpty = !data || data.totalOrders === 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Faturamento"
          value={formatCurrency(data?.faturamento ?? 0)}
          icon={DollarSign}
          trend="neutral"
        />
        <MetricCard
          title="Ticket Médio"
          value={formatCurrency(data?.ticketMedio ?? 0)}
          icon={ShoppingCart}
          trend="neutral"
        />
        <MetricCard
          title="Total de Pedidos"
          value={String(data?.totalOrders ?? 0)}
          icon={Package}
          trend="neutral"
        />
        <MetricCard
          title="Pedidos Finalizados"
          value={String(data?.finishedOrders ?? 0)}
          icon={CheckCircle2}
          trend="neutral"
        />
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Nenhum pedido encontrado no período selecionado.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Sincronize pedidos do Tiny ERP em{" "}
            <a href="/tiny" className="underline hover:text-primary">
              Sistema &gt; Tiny ERP
            </a>
            {" "}ou crie pedidos no{" "}
            <a href="/pipeline" className="underline hover:text-primary">
              Pipeline
            </a>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">Vendas ao longo do tempo</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.timeSeries ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="data"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => formatCurrency(v)}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Receita"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="vendas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top 5 produtos */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                <TrendingUp className="h-4 w-4" />
                Top 5 Produtos
              </h3>
              {(data?.topProdutos ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum produto vendido.</p>
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.topProdutos.map((p) => ({
                        nome: p.nome.length > 18 ? p.nome.slice(0, 18) + "…" : p.nome,
                        quantidade: p.quantidade,
                      })) ?? []}
                      layout="vertical"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="nome"
                        width={110}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(v: number) => [v, "Unid."]}
                      />
                      <Bar
                        dataKey="quantidade"
                        fill="hsl(var(--primary))"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Por tipo de pedido */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-4 text-base font-semibold">Pedidos por tipo</h3>
              {(data?.porTipo ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados de tipo.</p>
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.porTipo.map((t) => ({
                        tipo: ORDER_TYPE_LABELS[t.tipo] ?? t.tipo,
                        quantidade: t.quantidade,
                      })) ?? []}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="tipo"
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <YAxis
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(v: number) => [v, "Pedidos"]}
                      />
                      <Bar
                        dataKey="quantidade"
                        fill="hsl(var(--primary) / 0.8)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
