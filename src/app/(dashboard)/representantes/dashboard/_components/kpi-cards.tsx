"use client";

import { TrendingUp, TrendingDown, ShoppingBag, MapPin, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  comparison?: string;
  comparisonPositive?: boolean;
  subtitle?: string;
}

function KpiCard({
  title,
  value,
  icon,
  comparison,
  comparisonPositive,
  subtitle,
}: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {comparison && (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs font-medium",
              comparisonPositive === true
                ? "text-emerald-600"
                : comparisonPositive === false
                  ? "text-red-600"
                  : "text-muted-foreground"
            )}
          >
            {comparisonPositive === true && (
              <TrendingUp className="h-3.5 w-3.5" />
            )}
            {comparisonPositive === false && (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {comparison}
          </p>
        )}
        {subtitle && !comparison && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcDiff(current: number, prev: number): { label: string; positive: boolean } | null {
  if (prev === 0) return null;
  const diff = Math.round(((current - prev) / prev) * 100);
  const label =
    diff > 0
      ? `+${diff}% em relação ao mês anterior`
      : `${diff}% em relação ao mês anterior`;
  return { label, positive: diff > 0 };
}

interface GestorKpiCardsProps {
  totalSold: number;
  totalOrders: number;
  totalVisits: number;
  avgConversion: number | null;
  prevTotalSold: number;
  prevTotalOrders: number;
  targetTotal: number;
}

export function GestorKpiCards({
  totalSold,
  totalOrders,
  totalVisits,
  avgConversion,
  prevTotalSold,
  prevTotalOrders,
  targetTotal,
}: GestorKpiCardsProps) {
  const soldDiff = calcDiff(totalSold, prevTotalSold);
  const ordersDiff = calcDiff(totalOrders, prevTotalOrders);

  const targetPercent =
    targetTotal > 0 ? Math.round((totalSold / targetTotal) * 100) : null;

  const metaLabel =
    targetPercent !== null
      ? `${targetPercent}% da meta (${formatCurrency(targetTotal)})`
      : "Sem meta definida";

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        title="Total Vendido"
        value={formatCurrency(totalSold)}
        icon={<TrendingUp className="h-4 w-4" />}
        comparison={soldDiff?.label ?? metaLabel}
        comparisonPositive={
          soldDiff
            ? soldDiff.positive
            : targetPercent !== null
              ? targetPercent >= 100
              : undefined
        }
      />

      <KpiCard
        title="Total Pedidos"
        value={String(totalOrders)}
        icon={<ShoppingBag className="h-4 w-4" />}
        comparison={ordersDiff?.label}
        comparisonPositive={ordersDiff?.positive}
        subtitle="pedidos no período"
      />

      <KpiCard
        title="Total Visitas"
        value={String(totalVisits)}
        icon={<MapPin className="h-4 w-4" />}
        subtitle="visitas realizadas no período"
      />

      <KpiCard
        title="Conversão Média"
        value={avgConversion !== null ? `${avgConversion}%` : "—"}
        icon={<Users className="h-4 w-4" />}
        subtitle="visitas convertidas em venda"
      />
    </div>
  );
}
