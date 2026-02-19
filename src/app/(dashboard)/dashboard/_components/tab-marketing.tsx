"use client";

import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "./metric-card";
import { Megaphone, Target, MousePointer, CheckCircle } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getMarketingData,
  getPeriodRange,
  type PeriodValue,
} from "@/services/dashboard.service";

interface TabMarketingProps {
  period: PeriodValue;
}

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--primary) / 0.5)",
  "#10b981",
  "#ef4444",
];

function TabMarketingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

export function TabMarketing({ period }: TabMarketingProps) {
  const range = getPeriodRange(period);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "marketing", period],
    queryFn: () => getMarketingData(range),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <TabMarketingSkeleton />;

  if (isError) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed p-16 text-center">
        <p className="text-sm text-destructive">Erro ao carregar dados de marketing.</p>
      </div>
    );
  }

  const isEmpty = !data || (data.orcamentosRecebidos === 0 && data.pedidosPromocionais === 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Pedidos Promocionais"
          value={String(data?.pedidosPromocionais ?? 0)}
          icon={Megaphone}
          trend="neutral"
        />
        <MetricCard
          title="Orçamentos Recebidos"
          value={String(data?.orcamentosRecebidos ?? 0)}
          icon={Target}
          trend="neutral"
        />
        <MetricCard
          title="Orçamentos Aprovados"
          value={String(data?.orcamentosAprovados ?? 0)}
          icon={CheckCircle}
          trend="neutral"
        />
        <MetricCard
          title="Taxa de Conversão"
          value={`${(data?.taxaConversao ?? 0).toFixed(1)}%`}
          icon={MousePointer}
          trend={
            (data?.taxaConversao ?? 0) > 20
              ? "up"
              : (data?.taxaConversao ?? 0) > 0
                ? "neutral"
                : "down"
          }
        />
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Nenhum orçamento ou pedido promocional no período.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Receba orçamentos pelo{" "}
            <a href="/quote" className="underline hover:text-primary">
              formulário público de orçamento
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Status dos orçamentos */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-base font-semibold">
              Orçamentos públicos por status
            </h3>
            {(data?.orcamentosPorStatus ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum orçamento no período.
              </p>
            ) : (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.orcamentosPorStatus ?? []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="quantidade"
                      nameKey="status"
                      label={({ status, percent }) =>
                        `${status} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {(data?.orcamentosPorStatus ?? []).map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(v: number) => [v, "Orçamentos"]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Taxa de conversão visual */}
          <div className="rounded-lg border bg-card p-6 flex flex-col justify-center items-center gap-4">
            <h3 className="text-base font-semibold self-start">Funil de conversão</h3>
            <div className="w-full space-y-3">
              <div>
                <div className="flex justify-between mb-1 text-sm">
                  <span className="text-muted-foreground">Recebidos</span>
                  <span className="font-medium">{data?.orcamentosRecebidos ?? 0}</span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-primary"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1 text-sm">
                  <span className="text-muted-foreground">Aprovados</span>
                  <span className="font-medium">{data?.orcamentosAprovados ?? 0}</span>
                </div>
                <div className="h-3 w-full rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-emerald-500"
                    style={{
                      width: `${(data?.orcamentosRecebidos ?? 0) > 0
                        ? ((data?.orcamentosAprovados ?? 0) / (data?.orcamentosRecebidos ?? 1)) * 100
                        : 0
                        }%`,
                    }}
                  />
                </div>
              </div>
              <p className="text-center text-2xl font-bold mt-2">
                {(data?.taxaConversao ?? 0).toFixed(1)}%
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  taxa de conversão
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
