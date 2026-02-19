"use client";

import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "./metric-card";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, CheckCircle2, Clock, FileText } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getFinanceiroData,
  getPeriodRange,
  type PeriodValue,
} from "@/services/dashboard.service";

interface TabFinanceiroProps {
  period: PeriodValue;
}

function TabFinanceiroSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-lg" />
    </div>
  );
}

export function TabFinanceiro({ period }: TabFinanceiroProps) {
  const range = getPeriodRange(period);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "financeiro", period],
    queryFn: () => getFinanceiroData(range),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <TabFinanceiroSkeleton />;

  if (isError) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed p-16 text-center">
        <p className="text-sm text-destructive">Erro ao carregar dados financeiros.</p>
      </div>
    );
  }

  const isEmpty = !data || data.receitaFaturada === 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Receita Faturada"
          value={formatCurrency(data?.receitaFaturada ?? 0)}
          icon={DollarSign}
          trend="neutral"
        />
        <MetricCard
          title="Pedidos Pagos"
          value={String(data?.pedidosPagos ?? 0)}
          icon={CheckCircle2}
          trend={
            (data?.pedidosPagos ?? 0) > 0 ? "up" : "neutral"
          }
        />
        <MetricCard
          title="Aguardando Pagamento"
          value={String(data?.pedidosAguardandoPagamento ?? 0)}
          icon={Clock}
          trend={
            (data?.pedidosAguardandoPagamento ?? 0) > 0 ? "down" : "neutral"
          }
        />
        <MetricCard
          title="Orçamentos Pendentes"
          value={formatCurrency(data?.orcamentosPendentesValor ?? 0)}
          icon={FileText}
          trend="neutral"
        />
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Nenhum pedido faturado no período selecionado.
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
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Receita faturada por dia</h3>
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
                  formatter={(value: number) => [
                    formatCurrency(value),
                    "Receita",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="receita"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
