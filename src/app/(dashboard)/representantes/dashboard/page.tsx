"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import { getGestorDashboardData } from "@/services/rep-dashboard.service";
import { GestorKpiCards } from "./_components/kpi-cards";
import { RankingTable } from "./_components/ranking-table";
import { AttributionChart } from "./_components/attribution-chart";
import { PipelineOverview } from "./_components/pipeline-overview";
import { AlertsList } from "./_components/alerts-list";
import { CommissionTable } from "./_components/commission-table";
import { EvolutionChart } from "./_components/evolution-chart";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function MonthNavigator({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const label = `${MONTH_NAMES[value.getMonth()]} ${value.getFullYear()}`;

  function prev() {
    onChange(new Date(value.getFullYear(), value.getMonth() - 1, 1));
  }
  function next() {
    const n = new Date(value.getFullYear(), value.getMonth() + 1, 1);
    if (n <= new Date()) onChange(n);
  }

  const isCurrentMonth =
    value.getMonth() === new Date().getMonth() &&
    value.getFullYear() === new Date().getFullYear();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={prev}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[140px] text-center text-sm font-medium">
        {label}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={next}
        disabled={isCurrentMonth}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <Skeleton className="col-span-2 h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export default function GestorDashboardPage() {
  const router = useRouter();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const [month, setMonth] = useState<Date>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedRep, setSelectedRep] = useState<string>("__all__");

  useEffect(() => {
    if (!permissionsLoading && !can("representantes.view")) {
      router.replace("/pipeline");
    }
  }, [permissionsLoading, can, router]);

  const filterRepId = selectedRep === "__all__" ? null : selectedRep;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["gestor-dashboard", month.toISOString().slice(0, 7), filterRepId],
    queryFn: () => getGestorDashboardData(month, filterRepId),
    enabled: !permissionsLoading && can("representantes.view"),
    staleTime: 2 * 60 * 1000,
  });

  if (permissionsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Verificando permissões...</p>
      </div>
    );
  }

  if (!can("representantes.view")) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para acessar este dashboard.
        </p>
      </div>
    );
  }

  const repsList = data?.repsList ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dashboard Representantes
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe a performance da equipe em tempo real
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro de representante */}
          <Select value={selectedRep} onValueChange={setSelectedRep}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Todos os representantes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os representantes</SelectItem>
              {repsList.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro de mês */}
          <MonthNavigator value={month} onChange={setMonth} />
        </div>
      </div>

      {isLoading && <DashboardSkeleton />}

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          Erro ao carregar os dados do dashboard. Tente novamente.
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* KPIs Gerais */}
          <GestorKpiCards
            totalSold={data.totalSold}
            totalOrders={data.totalOrders}
            totalVisits={data.totalVisits}
            avgConversion={data.avgConversion}
            prevTotalSold={data.prevTotalSold}
            prevTotalOrders={data.prevTotalOrders}
            targetTotal={data.targetTotal}
          />

          {/* Ranking + Atribuição */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RankingTable reps={data.reps} />
            </div>
            <div>
              <AttributionChart data={data.attribution} />
            </div>
          </div>

          {/* Pipeline + Alertas */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <PipelineOverview data={data.pipeline} />
            <AlertsList alerts={data.alerts} />
          </div>

          {/* Comissões + Evolução */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <CommissionTable rows={data.commissions} />
            <EvolutionChart
              data={data.evolution}
              filterRepId={filterRepId}
            />
          </div>
        </>
      )}
    </div>
  );
}
