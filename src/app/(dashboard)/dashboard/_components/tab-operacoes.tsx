"use client";

import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "./metric-card";
import {
  Activity,
  AlertCircle,
  Users,
  Archive,
  Package,
  Truck,
  Percent,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getOperacoesPersonalizadasData,
  getPeriodRange,
  type PeriodValue,
} from "@/services/dashboard.service";

interface TabOperacoesProps {
  period: PeriodValue;
}

function TabOperacoesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}

export function TabOperacoes({ period }: TabOperacoesProps) {
  const range = getPeriodRange(period);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "operacoes-personalizadas", period],
    queryFn: () => getOperacoesPersonalizadasData(range),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <TabOperacoesSkeleton />;

  if (isError) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed p-16 text-center">
        <p className="text-sm text-destructive">
          Erro ao carregar dados de operações.
        </p>
      </div>
    );
  }

  const isEmpty = !data || data.totalPersonalizadas === 0;
  const hasArquivados = (data?.totalArquivados ?? 0) > 0;
  const hasCores = (data?.coresMaisUsadas?.length ?? 0) > 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Personalizadas</h2>
          <a
            href="/pipeline?tipo=PERSONALIZADO"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
          >
            Ver no Pipeline
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <UITooltip>
            <TooltipTrigger asChild>
              <div>
                <MetricCard
                  title="Total personalizadas"
                  value={String(data?.totalPersonalizadas ?? 0)}
                  icon={Package}
                  trend="neutral"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Pedidos personalizados no período selecionado</p>
            </TooltipContent>
          </UITooltip>
          <UITooltip>
            <TooltipTrigger asChild>
              <div>
                <MetricCard
                  title="Personalizadas ativas"
                  value={String(data?.personalizadasAtivas ?? 0)}
                  icon={Activity}
                  trend="neutral"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Em Fazer, Aprovação, Produção ou Expedição</p>
            </TooltipContent>
          </UITooltip>
          <UITooltip>
            <TooltipTrigger asChild>
              <div>
                <MetricCard
                  title="Atrasadas"
                  value={String(data?.personalizadasAtrasadas ?? 0)}
                  icon={AlertCircle}
                  trend={
                    (data?.personalizadasAtrasadas ?? 0) > 0 ? "down" : "neutral"
                  }
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Com data de entrega vencida e ainda em andamento</p>
            </TooltipContent>
          </UITooltip>
          <UITooltip>
            <TooltipTrigger asChild>
              <div>
                <MetricCard
                  title="Entregues no período"
                  value={String(data?.personalizadasEntregues ?? 0)}
                  icon={Truck}
                  trend="neutral"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Pedidos com status Entregue no período</p>
            </TooltipContent>
          </UITooltip>
          <UITooltip>
            <TooltipTrigger asChild>
              <div>
                <MetricCard
                  title="Taxa de entrega"
                  value={`${(data?.taxaEntrega ?? 0).toFixed(1)}%`}
                  icon={Percent}
                  trend={
                    (data?.taxaEntrega ?? 0) >= 70
                      ? "up"
                      : (data?.taxaEntrega ?? 0) > 0
                        ? "neutral"
                        : "down"
                  }
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Percentual de pedidos entregues em relação ao total</p>
            </TooltipContent>
          </UITooltip>
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-16 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Nenhum pedido personalizado no período selecionado.
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
          <div className="space-y-6">
            {/* Pipeline das personalizadas */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-4 text-base font-semibold">
                Pipeline das personalizadas
              </h3>
              <div className="space-y-3">
                {(data?.funilPipeline ?? []).map((item) => (
                  <div key={item.etapa} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.etapa}</span>
                      <span className="font-medium">{item.quantidade}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${
                            (data?.totalPersonalizadas ?? 0) > 0
                              ? (item.quantidade /
                                  (data?.totalPersonalizadas ?? 1)) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Por status */}
              <div className="rounded-lg border bg-card p-6">
                <h3 className="mb-4 text-base font-semibold">
                  Pedidos por status
                </h3>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.porStatus ?? []}
                      layout="vertical"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 11,
                        }}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={110}
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 11,
                        }}
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
                        fill="hsl(var(--primary))"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top produtos personalizados */}
              <div className="rounded-lg border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                  <Package className="h-4 w-4" />
                  Top produtos personalizados
                </h3>
                {(data?.porProduto ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sem dados de produtos.
                  </p>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(data?.porProduto ?? []).map((p) => ({
                          nome:
                            p.nome.length > 20
                              ? p.nome.slice(0, 20) + "…"
                              : p.nome,
                          quantidade: p.quantidade,
                        }))}
                        layout="vertical"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          type="category"
                          dataKey="nome"
                          width={120}
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 11,
                          }}
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
                          fill="hsl(var(--primary) / 0.8)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Por responsável */}
              <div className="rounded-lg border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                  <Users className="h-4 w-4" />
                  Por responsável
                </h3>
                {(data?.porResponsavel ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sem dados de responsável.
                  </p>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data?.porResponsavel ?? []}
                        layout="vertical"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          type="category"
                          dataKey="nome"
                          width={120}
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 11,
                          }}
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
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Por categoria */}
              <div className="rounded-lg border bg-card p-6">
                <h3 className="mb-4 text-base font-semibold">
                  Por categoria de produto
                </h3>
                {(data?.porCategoria ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sem dados de categoria.
                  </p>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data?.porCategoria ?? []}
                        layout="vertical"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          type="category"
                          dataKey="categoria"
                          width={120}
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 11,
                          }}
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
                          fill="hsl(var(--primary) / 0.6)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Cores mais usadas */}
            {hasCores && (
              <div className="rounded-lg border bg-card p-6">
                <h3 className="mb-4 text-base font-semibold">
                  Cores mais usadas
                </h3>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.coresMaisUsadas ?? []}
                      layout="vertical"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 11,
                        }}
                      />
                      <YAxis
                        type="category"
                        dataKey="cor"
                        width={90}
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 11,
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(v: number) => [v, "Vezes"]}
                      />
                      <Bar
                        dataKey="quantidade"
                        fill="hsl(var(--primary) / 0.7)"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Arquivados por período */}
            {hasArquivados && (data?.arquivadosPorPeriodo?.length ?? 0) > 0 && (
              <div className="rounded-lg border bg-card p-6">
                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                  <Archive className="h-4 w-4" />
                  Arquivados por período
                </h3>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.arquivadosPorPeriodo ?? []}
                      layout="vertical"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 11,
                        }}
                      />
                      <YAxis
                        type="category"
                        dataKey="periodo"
                        width={90}
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 11,
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(v: number) => [v, "Arquivados"]}
                      />
                      <Bar
                        dataKey="quantidade"
                        fill="hsl(var(--muted-foreground) / 0.6)"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  <a
                    href="/pipeline?tipo=PERSONALIZADO"
                    className="underline hover:text-primary"
                  >
                    Ver arquivados no Pipeline
                  </a>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
