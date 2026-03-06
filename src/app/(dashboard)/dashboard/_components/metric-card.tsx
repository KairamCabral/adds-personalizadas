"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  extra?: React.ReactNode;
  iconVariant?: "primary" | "accent" | "muted" | "success" | "warning";
}

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  trend = "neutral",
  extra,
  iconVariant = "primary",
}: MetricCardProps) {
  const TrendIcon =
    trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;

  const changeColor =
    trend === "up"
      ? "text-emerald-700 dark:text-emerald-400"
      : trend === "down"
        ? "text-red-700 dark:text-red-400"
        : "text-muted-foreground";

  const iconBgColor = {
    primary: "bg-dashboard-primary/15 text-dashboard-primary",
    accent: "bg-dashboard-accent/15 text-dashboard-accent",
    muted: "bg-muted text-muted-foreground",
    success: "bg-dashboard-success/15 text-dashboard-success",
    warning: "bg-dashboard-warning/15 text-dashboard-warning",
  }[iconVariant];

  return (
    <Card className="group relative overflow-hidden border border-border/50 bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:border-dashboard-primary/15">
      <div className="absolute inset-0 bg-gradient-to-br from-dashboard-primary/[0.02] to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <CardContent className="relative p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
              <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {value}
              </p>
              {extra}
            </div>
            {change !== undefined && (
              <div
                className={cn(
                  "mt-1 flex items-center gap-1 text-xs font-medium",
                  changeColor
                )}
              >
                <TrendIcon className="h-3 w-3 shrink-0" />
                <span>
                  {change > 0 ? "+" : ""}
                  {change}%
                </span>
                <span className="font-normal text-muted-foreground">
                  vs anterior
                </span>
              </div>
            )}
          </div>
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105",
              iconBgColor
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
