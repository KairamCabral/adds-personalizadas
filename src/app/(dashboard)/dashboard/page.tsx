"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { PeriodSelector } from "./_components/period-selector";
import { MetricCard } from "./_components/metric-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Users,
  UserPlus,
  Package,
  CheckCircle2,
  Archive,
  AlertTriangle,
  Clock,
  Percent,
  Trophy,
} from "lucide-react";
import {
  getDashboardCrmData,
  getPeriodRange,
  formatPeriodLabel,
  type PeriodValue,
} from "@/services/dashboard.service";

const STATUS_LABELS: Record<string, string> = {
  FAZER: "Fazer",
  AJUSTE: "Ajuste",
  APROVACAO: "Aprovação",
  APROVADO: "Confirmação",
  ARTE_APROVADA: "Aprovado",
  PRODUCAO: "Produção",
  EXPEDICAO: "Expedição",
  FINALIZADO: "Finalizado",
  ENTREGUE: "Entregue",
  FATURADO: "Faturado",
};

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}

function formatHoras(horas: number): string {
  if (horas < 1) {
    const min = Math.round(horas * 60);
    return `${min}min`;
  }
  if (horas < 24) {
    return `${horas.toFixed(1)}h`;
  }
  const dias = Math.floor(horas / 24);
  const horasRestantes = Math.round(horas % 24);
  if (horasRestantes === 0) return `${dias}d`;
  return `${dias}d ${horasRestantes}h`;
}

export default function DashboardPage() {
  const { can } = usePermissions();
  const [period, setPeriod] = useState<PeriodValue>("30d");

  const range = getPeriodRange(period);
  const periodLabel = formatPeriodLabel(range);
  const canView =
    can("dashboard.view_clientes") || can("dashboard.view_operacoes");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "crm", period],
    queryFn: () => getDashboardCrmData(range),
    staleTime: 5 * 60 * 1000,
    enabled: canView,
  });

  if (!canView) {
    return (
      <div className="p-6">
        <PageHeader title="Dashboard" className="mb-6" />
        <div className="flex items-center justify-center rounded-xl border border-dashed p-16 text-center">
          <p className="text-sm text-muted-foreground">
            Sem permissão para visualizar o dashboard.
          </p>
        </div>
      </div>
    );
  }

  const totalFunil = data
    ? data.funil.fazerAprovacao +
      data.funil.producao +
      data.funil.expedicao +
      data.funil.finalizado
    : 0;

  const funilData = data
    ? [
        { etapa: "Fazer / Aprovação", quantidade: data.funil.fazerAprovacao },
        { etapa: "Produção", quantidade: data.funil.producao },
        { etapa: "Expedição", quantidade: data.funil.expedicao },
        { etapa: "Finalizado", quantidade: data.funil.finalizado },
      ]
    : [];

  return (
    <TooltipProvider>
      <div className="p-6">
        <PageHeader
          title="Dashboard CRM"
          description={`Visão estratégica · ${periodLabel}`}
          className="mb-6"
        >
          <PeriodSelector value={period} onChange={setPeriod} />
        </PageHeader>

        {isLoading && <DashboardSkeleton />}

        {isError && (
          <div className="flex items-center justify-center rounded-xl border border-dashed p-16 text-center">
            <p className="text-sm text-destructive">
              Erro ao carregar dados do dashboard.
            </p>
          </div>
        )}

        {data && (
          <div className="space-y-8">
            {/* SEÇÃO 1: Cards de resumo */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <UITooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      title="Clientes CRM"
                      value={String(data.totalClientes)}
                      icon={Users}
                      trend="neutral"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Total acumulado, sem filtro de data</TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      title="Novos clientes"
                      value={String(data.novosClientes)}
                      icon={UserPlus}
                      trend="neutral"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Criados no período selecionado</TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      title="Pedidos no pipeline"
                      value={String(data.pedidosAtivos)}
                      icon={Package}
                      trend="neutral"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Pedidos ativos (não arquivados), sem filtro de data
                </TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      title="Criados no período"
                      value={String(data.pedidosCriados)}
                      icon={Package}
                      trend="neutral"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Pedidos CRM criados no período selecionado
                </TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      title="Finalizados"
                      value={String(data.pedidosFinalizados)}
                      icon={CheckCircle2}
                      trend="neutral"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Chegaram a status final no período
                </TooltipContent>
              </UITooltip>
            </div>

            {/* Cards secundários */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <UITooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      title="Atrasados"
                      value={String(data.pedidosAtrasados)}
                      icon={AlertTriangle}
                      trend={data.pedidosAtrasados > 0 ? "down" : "neutral"}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Data de entrega vencida e ainda no pipeline
                </TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      title="Arquivados"
                      value={String(data.pedidosArquivados)}
                      icon={Archive}
                      trend="neutral"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Arquivados no período selecionado
                </TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      title="Taxa de conclusão"
                      value={`${data.taxaConclusao}%`}
                      icon={Percent}
                      trend={
                        data.taxaConclusao >= 70
                          ? "up"
                          : data.taxaConclusao > 0
                            ? "neutral"
                            : "down"
                      }
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Finalizados ÷ Criados no período
                </TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      title="Tempo médio total"
                      value={
                        data.tempoMedioTotal.pedidos > 0
                          ? formatHoras(data.tempoMedioTotal.mediaHoras)
                          : "—"
                      }
                      icon={Clock}
                      trend="neutral"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Da criação à finalização (
                  {data.tempoMedioTotal.pedidos} pedido
                  {data.tempoMedioTotal.pedidos !== 1 ? "s" : ""})
                </TooltipContent>
              </UITooltip>
            </div>

            {/* SEÇÃO 2: Tempo por etapa + Funil */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Tempo médio por etapa (gargalo) */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="mb-1 flex items-center gap-2 text-base font-semibold">
                    <Clock className="h-4 w-4" />
                    Tempo médio por etapa
                  </h3>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Baseado nas transições de status dos pedidos CRM
                  </p>

                  {data.tempoPorEtapa.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Sem dados de transição de status ainda.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {data.tempoPorEtapa.map((item) => {
                        const maxHoras = Math.max(
                          ...data.tempoPorEtapa.map((e) => e.mediaHoras)
                        );
                        const pct =
                          maxHoras > 0
                            ? (item.mediaHoras / maxHoras) * 100
                            : 0;

                        return (
                          <div key={item.etapa} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <span className="text-muted-foreground">
                                  {STATUS_LABELS[item.etapa] ?? item.etapa}
                                </span>
                                {item.isBottleneck && (
                                  <Badge
                                    variant="destructive"
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    Gargalo
                                  </Badge>
                                )}
                              </span>
                              <span className="font-medium tabular-nums">
                                {formatHoras(item.mediaHoras)}
                                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                                  ({item.pedidos})
                                </span>
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  item.isBottleneck
                                    ? "bg-destructive"
                                    : "bg-primary"
                                }`}
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Funil do pipeline */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="mb-1 flex items-center gap-2 text-base font-semibold">
                    <Package className="h-4 w-4" />
                    Funil do Pipeline
                  </h3>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Distribuição atual dos pedidos ativos
                  </p>

                  {totalFunil === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum pedido no pipeline.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {funilData.map((item) => {
                        const pct =
                          totalFunil > 0
                            ? (item.quantidade / totalFunil) * 100
                            : 0;
                        return (
                          <div key={item.etapa} className="space-y-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {item.etapa}
                              </span>
                              <span className="font-medium tabular-nums">
                                {item.quantidade}
                                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                                  ({pct.toFixed(0)}%)
                                </span>
                              </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{
                                  width: `${Math.max(pct, 2)}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* SEÇÃO 3: Top clientes + Por responsável */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Top clientes */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                    <Trophy className="h-4 w-4" />
                    Top clientes no período
                  </h3>

                  {data.topClientes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Nenhum pedido CRM no período.
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Cadastre clientes em{" "}
                        <a
                          href="/contacts"
                          className="underline hover:text-primary"
                        >
                          Contatos
                        </a>{" "}
                        e crie pedidos no{" "}
                        <a
                          href="/pipeline"
                          className="underline hover:text-primary"
                        >
                          Pipeline
                        </a>
                        .
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="text-right">Pedidos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topClientes.map((cliente, idx) => (
                          <TableRow key={cliente.id}>
                            <TableCell className="text-muted-foreground text-xs">
                              {idx + 1}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{cliente.nome}</p>
                                {cliente.empresa && (
                                  <p className="text-xs text-muted-foreground">
                                    {cliente.empresa}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {cliente.totalPedidos}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Por responsável */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                    <Users className="h-4 w-4" />
                    Pedidos por responsável
                  </h3>

                  {data.porResponsavel.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Sem dados de responsável.
                    </p>
                  ) : (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.porResponsavel}
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
                            allowDecimals={false}
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
                            fill="hsl(var(--primary))"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* SEÇÃO 4: Por status (barras) */}
            {data.porStatus.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="mb-4 text-base font-semibold">
                    Pedidos ativos por status
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.porStatus.map((s) => ({
                          ...s,
                          label: STATUS_LABELS[s.status] ?? s.status,
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
                          allowDecimals={false}
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
                          fill="hsl(var(--primary) / 0.8)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
