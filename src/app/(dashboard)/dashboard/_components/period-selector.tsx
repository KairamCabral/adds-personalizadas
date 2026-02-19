"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PeriodValue } from "@/services/dashboard.service";

export type { PeriodValue };

const PERIODS: { value: PeriodValue; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "ano", label: "Ano" },
];

interface PeriodSelectorProps {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {PERIODS.map((period) => (
        <Button
          key={period.value}
          variant={value === period.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(period.value)}
          className={cn(
            "min-w-[3rem]",
            value === period.value && "bg-primary text-primary-foreground"
          )}
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
}
