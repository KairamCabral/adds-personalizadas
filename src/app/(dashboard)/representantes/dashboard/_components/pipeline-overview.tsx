"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PipelineOverviewData } from "@/services/rep-dashboard.service";

interface PipelineOverviewProps {
  data: PipelineOverviewData;
}

interface BarRowProps {
  label: string;
  count: number;
  max: number;
  color: string;
}

function BarRow({ label, count, max, color }: BarRowProps) {
  const percent = max > 0 ? Math.min((count / max) * 100, 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function PipelineOverview({ data }: PipelineOverviewProps) {
  const { VISITAR, RETORNO, VISITADO, lateReturns, leadsWithoutVisit } = data;
  const max = Math.max(VISITAR, RETORNO, VISITADO, 1);
  const totalLateReturns = lateReturns.reduce((s, r) => s + r.count, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pipeline Consolidado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <BarRow
            label="A Visitar"
            count={VISITAR}
            max={max}
            color="bg-blue-500"
          />
          <BarRow
            label="Retorno"
            count={RETORNO}
            max={max}
            color="bg-amber-500"
          />
          <BarRow
            label="Visitado"
            count={VISITADO}
            max={max}
            color="bg-emerald-500"
          />
        </div>

        {totalLateReturns > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                  {totalLateReturns} retorno{totalLateReturns > 1 ? "s" : ""} atrasado
                  {totalLateReturns > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  {lateReturns
                    .map((r) => `${r.repName.split(" ")[0]}: ${r.count}`)
                    .join(" · ")}
                </p>
              </div>
            </div>
          </div>
        )}

        {leadsWithoutVisit > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
            <p className="text-sm font-medium text-red-800 dark:text-red-400">
              📣 {leadsWithoutVisit} lead
              {leadsWithoutVisit > 1 ? "s" : ""} online sem visita há 7+ dias
            </p>
          </div>
        )}

        {totalLateReturns === 0 && leadsWithoutVisit === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma pendência crítica no pipeline.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
