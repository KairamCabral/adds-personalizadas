"use client";

import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DashboardAlert } from "@/services/rep-dashboard.service";

interface AlertsListProps {
  alerts: DashboardAlert[];
}

export function AlertsList({ alerts }: AlertsListProps) {
  const criticals = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Alertas Acionáveis</CardTitle>
          {alerts.length > 0 && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-semibold",
                criticals.length > 0
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
              )}
            >
              {alerts.length} alerta{alerts.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Tudo em ordem
            </p>
            <p className="text-xs text-muted-foreground">
              Nenhum alerta crítico no momento.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {criticals.length > 0 && (
              <div className="space-y-2">
                {criticals.map((alert, i) => (
                  <AlertItem key={i} alert={alert} />
                ))}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="space-y-2">
                {criticals.length > 0 && (
                  <div className="my-2 border-t border-border/50" />
                )}
                {warnings.map((alert, i) => (
                  <AlertItem key={i} alert={alert} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertItem({ alert }: { alert: DashboardAlert }) {
  const isCritical = alert.severity === "critical";

  return (
    <Link
      href={alert.href}
      className={cn(
        "group flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40",
        isCritical
          ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
          : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
      )}
    >
      <span className="mt-0.5 text-base leading-none">{alert.icon}</span>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium leading-tight",
            isCritical
              ? "text-red-800 dark:text-red-400"
              : "text-amber-800 dark:text-amber-400"
          )}
        >
          {alert.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground truncate">
          {alert.description}
        </p>
      </div>
      <ArrowRight
        className={cn(
          "mt-0.5 h-4 w-4 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
          isCritical ? "text-red-600" : "text-amber-600"
        )}
      />
    </Link>
  );
}
