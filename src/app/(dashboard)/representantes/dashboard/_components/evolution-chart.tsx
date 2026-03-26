"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvolutionMonth } from "@/services/rep-dashboard.service";

const REP_COLORS = [
  "#0077B6",
  "#F67A1A",
  "#10B981",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F59E0B",
  "#6366F1",
];

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

interface EvolutionChartProps {
  data: EvolutionMonth[];
  filterRepId?: string | null;
}

export function EvolutionChart({ data, filterRepId }: EvolutionChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evolução — Últimos 6 Meses</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Sem dados de evolução
        </CardContent>
      </Card>
    );
  }

  // Obter todos os repIds únicos presentes nos dados
  const allRepIds = Array.from(
    new Set(data.flatMap((m) => Object.keys(m.byRep)))
  );

  // Se estiver filtrando por um rep específico, mostrar só esse
  const repIds = filterRepId ? [filterRepId] : allRepIds;

  // Construir dados do gráfico
  const chartData = data.map((m) => {
    const point: Record<string, string | number> = {
      month: m.monthLabel,
      meta: m.targetTotal,
    };
    if (filterRepId) {
      point["Vendido"] = m.byRep[filterRepId] ?? 0;
    } else {
      for (const repId of repIds) {
        point[repId] = m.byRep[repId] ?? 0;
      }
    }
    return point;
  });

  const hasTarget = data.some((m) => m.targetTotal > 0);
  const maxValue = Math.max(
    ...data.map((m) =>
      Math.max(
        m.targetTotal,
        Object.values(m.byRep).reduce((s, v) => s + v, 0)
      )
    ),
    1
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Evolução — Últimos 6 Meses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatCurrencyShort}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                domain={[0, maxValue * 1.15]}
                width={70}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrencyShort(value),
                  name === "meta" ? "Meta Total" : name,
                ]}
                contentStyle={{
                  borderRadius: "8px",
                  fontSize: "12px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                }}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              />
              {repIds.length > 1 && (
                <Legend
                  iconType="rect"
                  iconSize={10}
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                />
              )}

              {/* Barras empilhadas por rep */}
              {filterRepId ? (
                <Bar
                  dataKey="Vendido"
                  fill={REP_COLORS[0]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={48}
                />
              ) : (
                repIds.map((repId, i) => (
                  <Bar
                    key={repId}
                    dataKey={repId}
                    stackId="a"
                    fill={REP_COLORS[i % REP_COLORS.length]}
                    radius={
                      i === repIds.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]
                    }
                    maxBarSize={48}
                  />
                ))
              )}

              {/* Linha de meta */}
              {hasTarget &&
                data.map((m, i) =>
                  m.targetTotal > 0 ? (
                    <ReferenceLine
                      key={i}
                      x={m.monthLabel}
                      stroke="#EF4444"
                      strokeDasharray="4 2"
                      strokeWidth={1.5}
                    />
                  ) : null
                )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {hasTarget && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-px w-5 border-t-2 border-dashed border-red-400" />
            Meta total
          </div>
        )}
      </CardContent>
    </Card>
  );
}
