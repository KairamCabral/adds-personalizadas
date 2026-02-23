"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import type { DiyPrintColor } from "../quote-wizard-types";

interface DiyColorSelectorProps {
  value: DiyPrintColor;
  onChange: (color: DiyPrintColor) => void;
}

const COLOR_OPTIONS: {
  id: DiyPrintColor;
  label: string;
  preview: string;
  desc: string;
}[] = [
  {
    id: "colorida",
    label: "Colorida",
    preview: "bg-gradient-to-br from-[#21add6] to-[#f07d00]",
    desc: "Impressão em cores (logo colorido)",
  },
  {
    id: "branca",
    label: "Branca",
    preview: "bg-white border border-gray-200",
    desc: "Impressão branca sobre escova escura",
  },
  {
    id: "preta",
    label: "Preta",
    preview: "bg-gray-900",
    desc: "Impressão preta sobre escova clara",
  },
];

export function DiyColorSelector({ value, onChange }: DiyColorSelectorProps) {
  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-semibold">Cor da Impressão</Label>

      <div className="grid grid-cols-3 gap-2">
        {COLOR_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all text-center",
              value === option.id
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border hover:border-primary/40",
            )}
          >
            <div className={cn("h-8 w-8 rounded-full", option.preview)} />
            <p className="text-xs font-medium">{option.label}</p>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">
        {COLOR_OPTIONS.find((o) => o.id === value)?.desc}
      </p>
    </div>
  );
}
