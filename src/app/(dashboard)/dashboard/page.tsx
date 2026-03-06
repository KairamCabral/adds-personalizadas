"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { PeriodSelector } from "./_components/period-selector";
import { MetricCard } from "./_components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Legend,
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
  BarChart3,
  TrendingDown,
} from "lucide-react";
import {
  getDashboardCrmData,
  getPeriodRange,
  formatPeriodLabel,
  formatRangeFromDates,
  type PeriodValue,
} from "@/services/dashboard.service";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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
          <Skeleton
            key={i}
            className="skeleton-shimmer h-36 rounded-xl"
          />
        ))}
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Skeleton className="skeleton-shimmer h-80 rounded-xl" />
        <Skeleton className="skeleton-shimmer h-80 rounded-xl" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Skeleton className="skeleton-shimmer h-72 rounded-xl" />
        <Skeleton className="skeleton-shimmer h-72 rounded-xl" />
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

function TrendBadge({
  current,
  previous,
  invertColor = false,
}: {
  current: number;
  previous: number;
  invertColor?: boolean;
}) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0)
    return (
      <span className="inline-flex items-center rounded-md bg-dashboard-success/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-dashboard-success">
        Novo
      </span>
    );

  const pctChange = ((current - previous) / previous) * 100;
  const isPositive = invertColor ? pctChange < 0 : pctChange > 0;
  const isNeutral = Math.abs(pctChange) < 0.5;

  if (isNeutral) return null;

  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isPositive
          ? "bg-dashboard-success/15 text-dashboard-success"
          : "bg-dashboard-danger/15 text-dashboard-danger"
      }`}
    >
      {isPositive ? "↑" : "↓"} {Math.abs(pctChange).toFixed(0)}%
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const [period, setPeriod] = useState<PeriodValue | null>("30d");
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const range = useMemo(() => {
    if (activeMonth && customFrom && customTo) {
      return formatRangeFromDates(customFrom, customTo);
    }
    if (customFrom && customTo && !period && !activeMonth) {
      return formatRangeFromDates(customFrom, customTo);
    }
    return getPeriodRange(period ?? "30d");
  }, [period, activeMonth, customFrom, customTo]);

  const periodLabel = useMemo(() => {
    if (activeMonth && customFrom && customTo) {
      return customFrom.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
    }
    if (customFrom && customTo && !period && !activeMonth) {
      return `${customFrom.toLocaleDateString("pt-BR")} – ${customTo.toLocaleDateString("pt-BR")}`;
    }
    return formatPeriodLabel(range);
  }, [period, activeMonth, customFrom, customTo, range]);

  const canView =
    can("dashboard.view_clientes") || can("dashboard.view_operacoes");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "crm", range.from, range.to],
    queryFn: () => getDashboardCrmData(range),
    staleTime: 5 * 60 * 1000,
    enabled: canView,
  });

  const handlePeriodChange = (p: PeriodValue) => {
    setPeriod(p);
    setActiveMonth(null);
    setCustomFrom(undefined);
    setCustomTo(undefined);
    setShowCustomPicker(false);
  };

  const handleMonthSelect = (key: string, from: Date, to: Date) => {
    setPeriod(null);
    setActiveMonth(key);
    setCustomFrom(from);
    setCustomTo(to);
    setShowCustomPicker(false);
  };

  const handleCustomApply = () => {
    setPeriod(null);
    setActiveMonth(null);
    setShowCustomPicker(false); // Fecha o popover
  };

  const handleCustomChange = (from: Date | undefined, to: Date | undefined) => {
    setCustomFrom(from);
    setCustomTo(to);
  };

  if (!canView) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 p-6">
        <PageHeader title="Dashboard" className="mb-6" />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Sem permissão para visualizar o dashboard
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            Entre em contato com o administrador
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 p-6">
        <PageHeader
          title="Dashboard CRM"
          description={`Visão estratégica · ${periodLabel}`}
          className="mb-8 [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_p]:text-base [&_p]:font-medium [&_p]:text-foreground/80"
        >
          <PeriodSelector
            period={period}
            activeMonth={activeMonth}
            customFrom={customFrom}
            customTo={customTo}
            showCustomPicker={showCustomPicker}
            onPeriodChange={handlePeriodChange}
            onMonthSelect={handleMonthSelect}
            onCustomChange={handleCustomChange}
            onCustomApply={handleCustomApply}
            onShowCustomPickerChange={setShowCustomPicker}
          />
        </PageHeader>

        {isLoading && <DashboardSkeleton />}

        {isError && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-16 text-center">
            <AlertTriangle className="mb-4 h-12 w-12 text-destructive/80" />
            <p className="text-sm font-medium text-destructive">
              Erro ao carregar dados do dashboard
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tente recarregar a página
            </p>
          </div>
        )}

        {data && (
          <div className="space-y-6 stagger-children">
            {/* KPIs: seção compacta */}
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <UITooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      title="Pedidos no pipeline hoje"
                      value={String(data.pedidosAtivos)}
                      icon={Package}
                      trend="neutral"
                      iconVariant="primary"
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
                      iconVariant="primary"
                      extra={
                        <TrendBadge
                          current={data.pedidosCriados}
                          previous={data.pedidosCriadosPrev ?? 0}
                        />
                      }
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
                      iconVariant="success"
                      extra={
                        <TrendBadge
                          current={data.pedidosFinalizados}
                          previous={data.pedidosFinalizadosPrev ?? 0}
                        />
                      }
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Chegaram a status final no período
                </TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      title="Taxa de conclusão"
                      value={`${data.taxaConclusao}%`}
                      icon={Percent}
                      iconVariant={
                        data.taxaConclusao >= 70
                          ? "success"
                          : data.taxaConclusao > 0
                            ? "accent"
                            : "muted"
                      }
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
                      title="Atrasados"
                      value={String(data.pedidosAtrasados)}
                      icon={AlertTriangle}
                      trend={data.pedidosAtrasados > 0 ? "down" : "neutral"}
                      iconVariant={data.pedidosAtrasados > 0 ? "warning" : "muted"}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Data de entrega vencida e ainda no pipeline
                </TooltipContent>
              </UITooltip>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <UITooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      title="Clientes CRM"
                      value={String(data.totalClientes)}
                      icon={Users}
                      trend="neutral"
                      iconVariant="primary"
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
                      iconVariant="accent"
                      extra={
                        <TrendBadge
                          current={data.novosClientes}
                          previous={data.novosClientesPrev ?? 0}
                        />
                      }
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Criados no período selecionado</TooltipContent>
              </UITooltip>
              <UITooltip>
                <TooltipTrigger asChild>
                  <div>
                    <MetricCard
                      title="Arquivados"
                      value={String(data.pedidosArquivados)}
                      icon={Archive}
                      trend="neutral"
                      iconVariant="muted"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Arquivados no período selecionado</TooltipContent>
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
                      iconVariant="primary"
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
            </div>

            {/* Tendência mensal */}
            {(data.tendencia?.length ?? 0) > 0 && (
              <Card className="overflow-hidden border border-border/60 bg-card shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dashboard-primary/15">
                      <BarChart3 className="h-5 w-5 text-dashboard-primary" />
                    </div>
                    Tendência Mensal
                  </CardTitle>
                  <p className="text-base font-medium text-foreground/70">
                    Pedidos criados vs finalizados nos últimos 6 meses
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(data.tendencia ?? []).map((t) => {
                          const label = format(
                            parseISO(t.mes + "-01"),
                            "MMM",
                            { locale: ptBR }
                          );
                          return {
                            ...t,
                            mesLabel:
                              label.charAt(0).toUpperCase() + label.slice(1),
                          };
                        })}
                        margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
                        barCategoryGap="18%"
                        barGap={8}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="mesLabel"
                          tick={{
                            fontSize: 14,
                            fontWeight: 600,
                            fill: "hsl(var(--foreground))",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{
                            fontSize: 14,
                            fontWeight: 600,
                            fill: "hsl(var(--foreground))",
                          }}
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: 20, fontSize: 14, fontWeight: 600 }}
                          iconType="circle"
                          iconSize={10}
                        />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "2px solid hsl(var(--border))",
                            borderRadius: "12px",
                            boxShadow: "0 8px 24px hsl(var(--foreground) / 0.12)",
                            padding: "14px 18px",
                            fontSize: "14px",
                            fontWeight: 600,
                          }}
                          labelStyle={{ fontWeight: 700, marginBottom: 6, fontSize: 15 }}
                        />
                        <Bar
                          dataKey="criados"
                          name="Criados"
                          fill="hsl(var(--dashboard-primary))"
                          radius={[8, 8, 0, 0]}
                          maxBarSize={56}
                        />
                        <Bar
                          dataKey="finalizados"
                          name="Finalizados"
                          fill="hsl(var(--dashboard-success))"
                          radius={[8, 8, 0, 0]}
                          maxBarSize={56}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ROW 3: Tempo por etapa + Funil real */}
            <div className="grid gap-6 lg:grid-cols-2">

              {/* Tempo médio por etapa (gargalo) */}
              <Card className="overflow-hidden border border-border/60 bg-card shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dashboard-primary/15">
                      <Clock className="h-5 w-5 text-dashboard-primary" />
                    </div>
                    Tempo médio por etapa
                  </CardTitle>
                  <p className="text-base font-medium text-foreground/70">
                    Baseado nas transições de status no período selecionado
                  </p>
                </CardHeader>
                <CardContent>
                  {data.tempoPorEtapa.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                        <Clock className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="text-base font-bold text-foreground">
                        Sem dados no período
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground/70">
                        As transições de status aparecerão aqui
                      </p>
                    </div>
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
                          <UITooltip key={item.etapa}>
                            <TooltipTrigger asChild>
                              <div className="space-y-2 cursor-help">
                                <div className="flex items-center justify-between text-base">
                                  <span className="flex items-center gap-2 font-semibold text-foreground">
                                    {STATUS_LABELS[item.etapa] ?? item.etapa}
                                    {item.isBottleneck && (
                                      <Badge
                                        className="bg-dashboard-danger text-xs font-bold text-white"
                                      >
                                        Gargalo
                                      </Badge>
                                    )}
                                  </span>
                                  <span className="text-lg font-bold tabular-nums text-foreground">
                                    {formatHoras(item.mediaHoras)}
                                    <span className="ml-2 text-sm font-medium text-foreground/70">
                                      ({item.pedidos})
                                    </span>
                                  </span>
                                </div>
                                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={`dashboard-progress-animate h-full rounded-full ${
                                      item.isBottleneck
                                        ? "bg-gradient-to-r from-dashboard-danger to-red-700"
                                        : "bg-gradient-to-r from-dashboard-primary to-dashboard-primary-strong"
                                    }`}
                                    style={{ width: `${Math.max(pct, 2)}%` }}
                                  />
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="border-2 border-border bg-popover px-5 py-4 shadow-xl"
                            >
                              <div className="space-y-2 text-sm">
                                <p className="font-bold text-foreground">
                                  Média: {formatHoras(item.mediaHoras)}
                                </p>
                                {item.medianaHoras != null && (
                                  <p className="font-medium text-foreground/80">
                                    Mediana: {formatHoras(item.medianaHoras)}
                                  </p>
                                )}
                                {item.minHoras != null && item.maxHoras != null && (
                                  <p className="font-medium text-foreground/80">
                                    Min: {formatHoras(item.minHoras)} · Max:{" "}
                                    {formatHoras(item.maxHoras)}
                                  </p>
                                )}
                                <p className="border-t border-border pt-2 font-semibold text-foreground/70">
                                  {item.pedidos} pedido
                                  {item.pedidos !== 1 ? "s" : ""} no período
                                </p>
                              </div>
                            </TooltipContent>
                          </UITooltip>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Funil de conversão real */}
              <Card className="overflow-hidden border border-border/60 bg-card shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dashboard-accent/15">
                      <TrendingDown className="h-5 w-5 text-dashboard-accent" />
                    </div>
                    Funil de Conversão
                  </CardTitle>
                  <p className="text-base font-medium text-foreground/70">
                    Pedidos que passaram por cada etapa no período
                  </p>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const FUNIL_ETAPAS_FIXAS = [
                      { etapa: "Entrada", ordem: 1 },
                      { etapa: "Aprovação", ordem: 2 },
                      { etapa: "Produção", ordem: 3 },
                      { etapa: "Expedição", ordem: 4 },
                      { etapa: "Finalizado", ordem: 5 },
                    ];
                    const funilCompleto = FUNIL_ETAPAS_FIXAS.map((etapaFixa) => {
                      const found = (data.funil ?? []).find(
                        (f) => f.etapa === etapaFixa.etapa
                      );
                      return {
                        etapa: etapaFixa.etapa,
                        quantidade: found?.quantidade ?? 0,
                        ordem: etapaFixa.ordem,
                      };
                    });
                    const maxQtd = Math.max(
                      ...funilCompleto.map((f) => f.quantidade),
                      1
                    );

                    return (
                      <div className="space-y-3">
                        {funilCompleto.map((item, index) => {
                          const pct =
                            maxQtd > 0
                              ? Math.max(
                                  (item.quantidade / maxQtd) * 100,
                                  item.quantidade > 0 ? 3 : 0
                                )
                              : 0;
                          const prevQtd =
                            index > 0
                              ? funilCompleto[index - 1]?.quantidade
                              : null;
                          const conversionRate = prevQtd
                            ? ((item.quantidade / prevQtd) * 100).toFixed(0)
                            : null;

                          return (
                            <div key={item.etapa} className="space-y-2">
                              <div className="flex items-center justify-between text-base">
                                <span className="font-bold text-foreground">
                                  {item.etapa}
                                </span>
                                <div className="flex items-center gap-3">
                                  {conversionRate != null && (
                                    <span className="text-sm font-semibold text-foreground/70">
                                      {conversionRate}% conv.
                                    </span>
                                  )}
                                  <span className="text-lg font-bold tabular-nums text-foreground">
                                    {item.quantidade}
                                  </span>
                                </div>
                              </div>
                              <div className="h-3.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="dashboard-progress-animate h-full rounded-full bg-gradient-to-r from-dashboard-primary to-dashboard-primary-strong"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        {funilCompleto[0].quantidade > 0 && (
                          <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
                            <span className="text-muted-foreground">
                              Conversão total (Entrada → Finalizado)
                            </span>
                            <span className="text-lg font-bold">
                              {(
                                (funilCompleto[4].quantidade /
                                  funilCompleto[0].quantidade) *
                                100
                              ).toFixed(0)}
                              %
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* ROW 4: Pedidos parados + Top clientes */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Pedidos parados */}
              <Card className="overflow-hidden border border-border/60 bg-card shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dashboard-warning/15">
                      <AlertTriangle className="h-5 w-5 text-dashboard-warning" />
                    </div>
                    Pedidos Parados
                  </CardTitle>
                  <p className="text-base font-medium text-foreground/70">
                    Sem mudança de status há mais tempo
                  </p>
                </CardHeader>
                <CardContent>
                  {!data.pedidosParados?.length ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-dashboard-success/15">
                        <CheckCircle2 className="h-7 w-7 text-dashboard-success" />
                      </div>
                      <p className="text-base font-bold text-foreground">
                        Nenhum pedido parado
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground/70">
                        Todos os pedidos estão em movimento
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(data.pedidosParados ?? []).map((p) => (
                        <div
                          key={p.id}
                          className="flex cursor-pointer items-center justify-between rounded-xl border border-transparent bg-muted/40 p-3 transition-all duration-200 hover:border-border hover:bg-muted/70 hover:shadow-sm"
                          onClick={() =>
                            router.push(`/pipeline?order=${p.id}`)
                          }
                        >
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-foreground">
                              {p.title}
                            </p>
                            <p className="text-sm font-medium text-foreground/70">
                              {STATUS_LABELS[p.status] ?? p.status}
                            </p>
                          </div>
                          <Badge
                            className={`shrink-0 tabular-nums font-bold ${
                              p.diasParado > 7
                                ? "bg-dashboard-danger text-white"
                                : p.diasParado > 3
                                  ? "bg-dashboard-warning text-white"
                                  : "bg-muted-foreground/20 text-foreground"
                            }`}
                          >
                            {p.diasParado}d parado
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top clientes */}
              <Card className="overflow-hidden border border-border/60 bg-card shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dashboard-accent/15">
                      <Trophy className="h-5 w-5 text-dashboard-accent" />
                    </div>
                    Top clientes no período
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topClientes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                        <Users className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="text-base font-bold text-foreground">
                        Nenhum pedido no período
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground/70">
                        Cadastre clientes em{" "}
                        <a
                          href="/contacts"
                          className="font-bold text-dashboard-primary underline-offset-4 hover:underline"
                        >
                          Contatos
                        </a>{" "}
                        e crie pedidos no{" "}
                        <a
                          href="/pipeline"
                          className="font-bold text-dashboard-primary underline-offset-4 hover:underline"
                        >
                          Pipeline
                        </a>
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-border hover:bg-transparent">
                          <TableHead className="w-12 text-base font-bold text-foreground">#</TableHead>
                          <TableHead className="text-base font-bold text-foreground">Cliente</TableHead>
                          <TableHead className="text-right text-base font-bold text-foreground">Pedidos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topClientes.map((cliente, idx) => (
                          <TableRow
                            key={cliente.id}
                            className="transition-colors hover:bg-muted/60"
                          >
                            <TableCell className="w-12 text-base font-semibold text-foreground/80">
                              {idx + 1}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-base font-bold text-foreground">{cliente.nome}</p>
                                {cliente.empresa && (
                                  <p className="text-sm font-medium text-foreground/70">
                                    {cliente.empresa}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-lg font-bold text-foreground">
                              {cliente.totalPedidos}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ROW 5: Por responsável */}
            <Card className="overflow-hidden border border-border/60 bg-card shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-xl font-bold">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dashboard-primary/15">
                    <Users className="h-5 w-5 text-dashboard-primary" />
                  </div>
                  Pedidos por responsável
                </CardTitle>
              </CardHeader>
              <CardContent>

                  {data.porResponsavel.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                        <Users className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="text-base font-bold text-foreground">
                        Sem dados de responsável
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground/70">
                        Atribua responsáveis aos pedidos no pipeline
                      </p>
                    </div>
                  ) : (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.porResponsavel.map((item) => ({
                            ...item,
                            nome:
                              item.nome?.includes("@")
                                ? item.nome
                                    .split("@")[0]
                                    .replace(/^./, (c) => c.toUpperCase())
                                : item.nome,
                          }))}
                          layout="vertical"
                          margin={{ left: 8, right: 8 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                            horizontal={false}
                          />
                          <XAxis
                            type="number"
                            tick={{
                              fill: "hsl(var(--foreground))",
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                            allowDecimals={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="nome"
                            width={140}
                            tick={{
                              fill: "hsl(var(--foreground))",
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "2px solid hsl(var(--border))",
                              borderRadius: "12px",
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                            formatter={(v: number) => [v, "Pedidos"]}
                          />
                          <Bar
                            dataKey="quantidade"
                            fill="hsl(var(--dashboard-primary))"
                            radius={[0, 6, 6, 0]}
                            maxBarSize={32}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* Por status (barras) */}
            {data.porStatus.length > 0 && (
              <Card className="overflow-hidden border border-border/60 bg-card shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dashboard-primary/15">
                      <BarChart3 className="h-5 w-5 text-dashboard-primary" />
                    </div>
                    Pedidos ativos por status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.porStatus.map((s) => ({
                          ...s,
                          label: STATUS_LABELS[s.status] ?? s.status,
                        }))}
                        layout="vertical"
                        margin={{ left: 8, right: 8 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{
                            fill: "hsl(var(--foreground))",
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={130}
                          tick={{
                            fill: "hsl(var(--foreground))",
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "2px solid hsl(var(--border))",
                            borderRadius: "12px",
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                          formatter={(v: number) => [v, "Pedidos"]}
                        />
                        <Bar
                          dataKey="quantidade"
                          fill="hsl(var(--dashboard-primary))"
                          radius={[0, 6, 6, 0]}
                          maxBarSize={32}
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
