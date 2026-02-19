"use client";

import { cn } from "@/lib/utils";

export interface ColorOption {
  key: string;
  label: string;
  hex: string | null;
}

interface ColorPickerProps {
  availableColors: ColorOption[];
  allowsCustomColor: boolean;
  selectedColors: string[];
  customColor: string | null;
  onChange: (colors: string[], customColor: string | null) => void;
}

export function ColorPicker({
  availableColors,
  allowsCustomColor,
  selectedColors,
  customColor,
  onChange,
}: ColorPickerProps) {
  const toggleColor = (key: string) => {
    const isSelected = selectedColors.includes(key);
    const newColors = isSelected
      ? selectedColors.filter((c) => c !== key)
      : [...selectedColors, key];
    const newCustomColor =
      key === "custom" && isSelected ? null : customColor;
    onChange(newColors, newCustomColor);
  };

  const handleCustomColorChange = (value: string) => {
    onChange(selectedColors, value.trim() || null);
  };

  const isCustomSelected = selectedColors.includes("custom");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {availableColors.map((color) => {
          const isSelected = selectedColors.includes(color.key);
          return (
            <button
              key={color.key}
              type="button"
              onClick={() => toggleColor(color.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                isSelected
                  ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/50"
              )}
            >
              <span
                className={cn(
                  "h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10",
                  color.key === "custom" && !color.hex &&
                    "bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500"
                )}
                style={color.hex ? { backgroundColor: color.hex } : undefined}
              />
              {color.label}
            </button>
          );
        })}
        {allowsCustomColor && (
          <button
            type="button"
            onClick={() => toggleColor("custom")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
              isCustomSelected
                ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/50"
            )}
          >
            <span className="h-4 w-4 shrink-0 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 ring-1 ring-black/10" />
            Cor personalizada
          </button>
        )}
      </div>
      {allowsCustomColor && isCustomSelected && (
        <input
          type="text"
          placeholder="Ex: Pantone 185 C, azul marinho..."
          value={customColor ?? ""}
          onChange={(e) => handleCustomColorChange(e.target.value)}
          className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
        />
      )}
    </div>
  );
}
