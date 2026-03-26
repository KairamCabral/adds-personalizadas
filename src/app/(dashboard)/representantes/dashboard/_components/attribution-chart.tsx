"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttributionEntry } from "@/services/rep-dashboard.service";

const COLORS: Record<string, string> = {
  PROSPECCAO: "#0077B6",
  ONLINE_VISITA: "#F67A1A",
  INDICACAO: "#10B981",
  APP_REPRESENTANTE: "#8B5CF6",
  OUTROS: "#94A3B8",
};

const LABELS: Record<string, string> = {
  PROSPECCAO: "Prospecção Direta",
  ONLINE_VISITA: "Online + Visita",
  INDICACAO: "Indicação",
  APP_REPRESENTANTE: "App Representante",
  OUTROS: "Outros",
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface AttributionChartProps {
  data: AttributionEntry[];
}

export function AttributionChart({ data }: AttributionChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0 || total === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Atribuição de Vendas</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Sem vendas no período
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: LABELS[d.origin] ?? d.origin,
    value: d.value,
    count: d.count,
    origin: d.origin,
    percent: Math.round((d.value / total) * 100),
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Atribuição de Vendas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.origin}
                    fill={COLORS[entry.origin] ?? "#94A3B8"}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [
                  formatCurrency(value),
                  "Valor",
                ]}
                contentStyle={{
                  borderRadius: "8px",
                  fontSize: "12px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 space-y-2">
          {chartData.map((entry) => (
            <div key={entry.origin} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[entry.origin] ?? "#94A3B8" }}
              />
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {entry.name}
              </span>
              <span className="text-xs font-semibold tabular-nums">
                {formatCurrency(entry.value)}
              </span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                {entry.percent}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
