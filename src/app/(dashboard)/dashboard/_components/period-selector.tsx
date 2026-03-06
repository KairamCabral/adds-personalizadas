"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PeriodValue } from "@/services/dashboard.service";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";

export type { PeriodValue };

const PERIODS: { value: PeriodValue; label: string; tooltip: string }[] = [
  { value: "hoje", label: "Hoje", tooltip: "Dados de hoje" },
  { value: "7d", label: "7d", tooltip: "Últimos 7 dias" },
  { value: "30d", label: "30d", tooltip: "Últimos 30 dias" },
  { value: "90d", label: "90d", tooltip: "Últimos 90 dias" },
  { value: "ano", label: "Ano", tooltip: "Ano atual" },
];

export interface MonthOption {
  key: string;
  label: string;
  labelFull: string;
  from: Date;
  to: Date;
}

interface PeriodSelectorProps {
  period: PeriodValue | null;
  activeMonth: string | null;
  customFrom: Date | undefined;
  customTo: Date | undefined;
  showCustomPicker: boolean;
  onPeriodChange: (p: PeriodValue) => void;
  onMonthSelect: (key: string, from: Date, to: Date) => void;
  onCustomChange: (from: Date | undefined, to: Date | undefined) => void;
  onCustomApply: () => void;
  onShowCustomPickerChange: (open: boolean) => void;
}

function getRecentMonths(): MonthOption[] {
  const months: MonthOption[] = [];
  const now = new Date();

  for (let i = 0; i < 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = new Date(date.getFullYear(), date.getMonth(), 1);
    const to = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    const toCapped = to > now ? now : to;
    const label = from.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
    const labelFull = from.toLocaleString("pt-BR", {
      month: "long",
      year: "numeric",
    });

    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      labelFull,
      from,
      to: toCapped,
    });
  }

  return months;
}

export function PeriodSelector({
  period,
  activeMonth,
  customFrom,
  customTo,
  showCustomPicker,
  onPeriodChange,
  onMonthSelect,
  onCustomChange,
  onCustomApply,
  onShowCustomPickerChange,
}: PeriodSelectorProps) {
  const recentMonths = getRecentMonths();

  const isCustomActive =
    customFrom &&
    customTo &&
    !activeMonth &&
    !period &&
    showCustomPicker === false;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span
          id="period-selector-label"
          className="text-sm font-medium text-muted-foreground"
        >
          Período
        </span>
        <div
          role="group"
          aria-labelledby="period-selector-label"
          aria-label="Filtrar por período"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-3 py-2 shadow-sm"
        >
        {/* Períodos rápidos */}
        <div
          role="group"
          aria-label="Períodos rápidos"
          className="flex items-center gap-1"
        >
          {PERIODS.map((p) => (
            <Tooltip key={p.value}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPeriodChange(p.value)}
                  aria-pressed={
                    period === p.value && !activeMonth && !isCustomActive
                  }
                  aria-label={`${p.label}: ${p.tooltip}`}
                  className={cn(
                    "min-h-9 min-w-9 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    period === p.value && !activeMonth && !isCustomActive
                      ? "bg-dashboard-primary text-white shadow-sm hover:bg-dashboard-primary-strong hover:text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {p.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {p.tooltip}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div
          className="h-6 w-px shrink-0 bg-border"
          aria-hidden
        />

        {/* Meses rápidos */}
        <div
          role="group"
          aria-label="Meses recentes"
          className="flex items-center gap-1"
        >
          {recentMonths.map((m) => (
            <Tooltip key={m.key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onMonthSelect(m.key, m.from, m.to)}
                  aria-pressed={activeMonth === m.key}
                  aria-label={`Mês: ${m.labelFull}`}
                  className={cn(
                    "min-h-9 min-w-9 rounded-lg px-2.5 py-2 text-sm font-medium capitalize transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    activeMonth === m.key
                      ? "bg-dashboard-primary text-white shadow-sm hover:bg-dashboard-primary-strong"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {m.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {m.labelFull}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div
          className="h-6 w-px shrink-0 bg-border"
          aria-hidden
        />

        {/* Personalizado */}
        <Popover open={showCustomPicker} onOpenChange={onShowCustomPickerChange}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-expanded={showCustomPicker}
                  aria-haspopup="dialog"
                  aria-label="Definir período personalizado"
                  className={cn(
                    "flex min-h-9 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    showCustomPicker || isCustomActive
                      ? "bg-dashboard-primary text-white shadow-sm hover:bg-dashboard-primary-strong"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                  <span>Personalizado</span>
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Escolher intervalo de datas
            </TooltipContent>
          </Tooltip>
          <PopoverContent
            className="w-auto p-4"
            align="end"
            sideOffset={8}
            aria-describedby="custom-period-description"
          >
            <div className="space-y-4">
              <div>
                <h3
                  id="custom-period-description"
                  className="text-sm font-semibold text-foreground"
                >
                  Período personalizado
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Selecione o intervalo de datas para filtrar os dados
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="space-y-1.5">
                  <label
                    htmlFor="period-from"
                    className="text-xs font-medium text-foreground"
                  >
                    De
                  </label>
                  <Input
                    id="period-from"
                    type="date"
                    value={
                      customFrom
                        ? format(customFrom, "yyyy-MM-dd")
                        : ""
                    }
                    onChange={(e) =>
                      onCustomChange(
                        e.target.value
                          ? new Date(e.target.value + "T00:00:00")
                          : undefined,
                        customTo
                      )
                    }
                    max={
                      customTo
                        ? format(customTo, "yyyy-MM-dd")
                        : format(new Date(), "yyyy-MM-dd")
                    }
                    className="h-9 w-full min-w-[140px] text-sm"
                    aria-label="Data inicial"
                  />
                </div>
                <span
                  className="hidden self-center text-muted-foreground sm:inline"
                  aria-hidden
                >
                  →
                </span>
                <div className="space-y-1.5">
                  <label
                    htmlFor="period-to"
                    className="text-xs font-medium text-foreground"
                  >
                    Até
                  </label>
                  <Input
                    id="period-to"
                    type="date"
                    value={
                      customTo ? format(customTo, "yyyy-MM-dd") : ""
                    }
                    onChange={(e) =>
                      onCustomChange(
                        customFrom,
                        e.target.value
                          ? new Date(e.target.value + "T23:59:59")
                          : undefined
                      )
                    }
                    min={
                      customFrom
                        ? format(customFrom, "yyyy-MM-dd")
                        : undefined
                    }
                    max={format(new Date(), "yyyy-MM-dd")}
                    className="h-9 w-full min-w-[140px] text-sm"
                    aria-label="Data final"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {customFrom && customTo && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      onCustomChange(undefined, undefined);
                    }}
                  >
                    Limpar
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={
                    !customFrom || !customTo || customFrom > customTo
                  }
                  onClick={onCustomApply}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        </div>
      </div>
    </TooltipProvider>
  );
}
