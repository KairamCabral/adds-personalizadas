"use client";

import { ColorOption } from "./color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/database.types";
import type { ColorQuantities } from "./order-form-step-products";

interface ProductSelectorProps {
  product: Product;
  colorQuantities: ColorQuantities;
  customColor: string | null;
  replicateQuantity: boolean;
  onColorQuantitiesChange: (
    colorQuantities: ColorQuantities,
    customColor: string | null
  ) => void;
  onReplicateQuantityChange: (value: boolean) => void;
  onRemove: () => void;
}

type ColorWithImage = ColorOption & { image_url?: string | null };

function parseAvailableColors(product: Product): ColorOption[] {
  const raw = product.available_colors;
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as ColorOption[]).filter(
    (c) => c && typeof c.key === "string" && typeof c.label === "string"
  );
}

function getDisplayImageUrl(
  product: Product,
  colorQuantities: ColorQuantities
): string | null {
  const raw = product.available_colors;
  const keys = Object.keys(colorQuantities);
  if (!raw || !Array.isArray(raw) || keys.length === 0) {
    return product.image_url ?? null;
  }
  const colors = raw as ColorWithImage[];
  const firstKey = keys[0];
  const colorWithImage = colors.find(
    (c) => c && c.key === firstKey && (c as ColorWithImage).image_url
  ) as ColorWithImage | undefined;
  if (colorWithImage?.image_url) {
    return colorWithImage.image_url;
  }
  return product.image_url ?? null;
}

export function ProductSelector({
  product,
  colorQuantities,
  customColor,
  replicateQuantity,
  onColorQuantitiesChange,
  onReplicateQuantityChange,
  onRemove,
}: ProductSelectorProps) {
  const availableColors = parseAvailableColors(product);
  const allowsCustomColor = product.allows_custom_color ?? true;
  const displayImageUrl = getDisplayImageUrl(product, colorQuantities);
  const totalQuantity = Object.values(colorQuantities).reduce(
    (a, b) => a + b,
    0
  );

  const addColor = (key: string) => {
    const qtyToUse = replicateQuantity
      ? (Object.values(colorQuantities)[0] ?? 1)
      : 1;
    onColorQuantitiesChange(
      { ...colorQuantities, [key]: qtyToUse },
      customColor
    );
  };

  const removeColor = (key: string) => {
    const next = { ...colorQuantities };
    delete next[key];
    onColorQuantitiesChange(next, key === "custom" ? null : customColor);
  };

  const setQuantity = (key: string, qty: number) => {
    const val = Math.max(1, Math.min(9999, qty));
    onColorQuantitiesChange(
      { ...colorQuantities, [key]: val },
      customColor
    );
  };

  const selectedKeys = Object.keys(colorQuantities);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Cabeçalho: produto + total + remover */}
      <div className="flex flex-col gap-3 p-4 pb-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {displayImageUrl ? (
            <img
              src={displayImageUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <span className="text-lg font-semibold">
                {product.name.charAt(0)}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">
              {product.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Selecione as cores e defina a quantidade de cada uma
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Total: <strong className="text-foreground">{totalQuantity}</strong> un
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
            aria-label="Remover produto"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cores com quantidade */}
      <div className="border-t border-border bg-muted/20 px-4 py-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Cor e quantidade
        </p>
        <div className="flex flex-wrap gap-2">
          {availableColors.map((color) => {
            const isSelected = color.key in colorQuantities;
            const qty = colorQuantities[color.key] ?? 1;
            return (
              <div
                key={color.key}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    isSelected ? removeColor(color.key) : addColor(color.key)
                  }
                  className="flex items-center gap-2"
                >
                  <span
                    className={cn(
                      "h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10",
                      color.key === "custom" &&
                        !color.hex &&
                        "bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500"
                    )}
                    style={
                      color.hex ? { backgroundColor: color.hex } : undefined
                    }
                  />
                  {color.label}
                </button>
                {isSelected && (
                  <div
                    className="flex items-center rounded-lg border border-border bg-background"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 hover:bg-muted"
                      onClick={() =>
                        setQuantity(color.key, Math.max(1, qty - 1))
                      }
                      aria-label="Diminuir"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={9999}
                      value={qty}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") return;
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 1) {
                          setQuantity(color.key, Math.min(9999, num));
                        }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val === "" || parseInt(val, 10) < 1) {
                          setQuantity(color.key, 1);
                        }
                      }}
                      className="h-7 w-10 border-0 text-center text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 hover:bg-muted"
                      onClick={() => setQuantity(color.key, qty + 1)}
                      aria-label="Aumentar"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {allowsCustomColor && (
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                "custom" in colorQuantities
                  ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/50"
              )}
            >
              <button
                type="button"
                onClick={() =>
                  "custom" in colorQuantities
                    ? removeColor("custom")
                    : addColor("custom")
                }
                className="flex items-center gap-2"
              >
                <span className="h-4 w-4 shrink-0 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 ring-1 ring-black/10" />
                Cor personalizada
              </button>
              {"custom" in colorQuantities && (
                <>
                  <div
                    className="flex items-center rounded-lg border border-border bg-background"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 hover:bg-muted"
                      onClick={() =>
                        setQuantity(
                          "custom",
                          Math.max(1, (colorQuantities["custom"] ?? 1) - 1)
                        )
                      }
                      aria-label="Diminuir"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={9999}
                      value={colorQuantities["custom"] ?? 1}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") return;
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 1) {
                          setQuantity("custom", Math.min(9999, num));
                        }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val === "" || parseInt(val, 10) < 1) {
                          setQuantity("custom", 1);
                        }
                      }}
                      className="h-7 w-10 border-0 text-center text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 hover:bg-muted"
                      onClick={() =>
                        setQuantity(
                          "custom",
                          (colorQuantities["custom"] ?? 1) + 1
                        )
                      }
                      aria-label="Aumentar"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: Pantone 185 C..."
                    value={customColor ?? ""}
                    onChange={(e) =>
                      onColorQuantitiesChange(colorQuantities, e.target.value.trim() || null)
                    }
                    className="h-7 w-24 rounded border border-border bg-background px-2 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                  />
                </>
              )}
            </div>
          )}
        </div>

        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={replicateQuantity}
            onCheckedChange={(v) => onReplicateQuantityChange(v === true)}
          />
          Replicar quantidade ao adicionar novas cores
        </label>
      </div>
    </div>
  );
}
