"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Trash2,
  Loader2,
  Package,
  Sliders,
} from "lucide-react";
import { getActiveProducts } from "@/services/quotes.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { WizardProductItem } from "./quote-wizard-types";

const DEFAULT_QTY_PER_COLOR = 100;
const QUICK_QUANTITIES = [24, 36, 72, 120];

interface ProductRecord {
  id: string;
  name: string;
  image_url: string | null;
  available_colors?: { key: string; label: string; hex?: string }[];
  allows_custom_color?: boolean | null;
}

interface StepProductsProps {
  selectedProducts: WizardProductItem[];
  onChange: (products: WizardProductItem[]) => void;
  onNext: () => void;
  onBack: () => void;
}

function getTotalQuantity(item: WizardProductItem): number {
  const qpc = item.quantity_per_color && Object.keys(item.quantity_per_color).length > 0
    ? item.quantity_per_color
    : null;
  if (qpc) return Object.values(qpc).reduce((a, b) => a + b, 0);
  return item.quantity;
}

function getQuantityPerColorOrFallback(item: WizardProductItem, colorKeys: string[]): Record<string, number> {
  const qpc = item.quantity_per_color;
  if (qpc && Object.keys(qpc).length > 0) {
    const out: Record<string, number> = {};
    colorKeys.forEach((k) => { out[k] = Math.max(0, qpc[k] ?? DEFAULT_QTY_PER_COLOR); });
    return out;
  }
  const single = item.quantity > 0 ? item.quantity : DEFAULT_QTY_PER_COLOR;
  const out: Record<string, number> = {};
  colorKeys.forEach((k) => { out[k] = single; });
  return out;
}

export function StepProducts({
  selectedProducts,
  onChange,
  onNext,
  onBack,
}: StepProductsProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    loop: true,
    skipSnaps: false,
    dragFree: false,
    containScroll: "trimSnaps",
  });
  const [prevBtnDisabled, setPrevBtnDisabled] = useState(true);
  const [nextBtnDisabled, setNextBtnDisabled] = useState(true);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setPrevBtnDisabled(!emblaApi.canScrollPrev());
    setNextBtnDisabled(!emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  const { data: products, isLoading } = useQuery({
    queryKey: ["public-products"],
    queryFn: getActiveProducts,
  });

  const productList = (products as ProductRecord[] | undefined) ?? [];

  const isProductSelected = (productId: string) =>
    selectedProducts.some((p) => p.product_id === productId);

  const addProduct = (product: ProductRecord) => {
    if (isProductSelected(product.id)) return;
    onChange([
      ...selectedProducts,
      {
        product_id: product.id,
        product_name: product.name,
        quantity: DEFAULT_QTY_PER_COLOR,
        colors: [],
        custom_color: null,
        quantity_per_color: undefined,
      },
    ]);
  };

  const removeProduct = (productId: string) => {
    onChange(selectedProducts.filter((p) => p.product_id !== productId));
  };

  const updateProduct = useCallback(
    (productId: string, updates: Partial<WizardProductItem>) => {
      onChange(
        selectedProducts.map((p) =>
          p.product_id === productId ? { ...p, ...updates } : p
        )
      );
    },
    [onChange, selectedProducts]
  );

  const toggleColor = (productId: string, colorKey: string) => {
    const product = selectedProducts.find((p) => p.product_id === productId);
    const catalog = productList.find((p) => p.id === productId);
    if (!product || !catalog) return;

    const availableColors = catalog.available_colors ?? [];
    const hasColor = product.colors.includes(colorKey);
    const newColors = hasColor
      ? product.colors.filter((c) => c !== colorKey)
      : [...product.colors, colorKey];

    const defaultQty = DEFAULT_QTY_PER_COLOR;
    const currentQpc = product.quantity_per_color && Object.keys(product.quantity_per_color).length > 0
      ? product.quantity_per_color
      : null;
    const firstQty = currentQpc && Object.keys(currentQpc).length > 0
      ? Object.values(currentQpc)[0] ?? defaultQty
      : product.quantity || defaultQty;

    const newQpc: Record<string, number> = {};
    newColors.forEach((k) => {
      newQpc[k] = currentQpc?.[k] ?? (k === colorKey && !hasColor ? firstQty : (currentQpc?.[k] ?? defaultQty));
    });

    updateProduct(productId, {
      colors: newColors,
      quantity_per_color: Object.keys(newQpc).length > 0 ? newQpc : undefined,
      quantity: Object.values(newQpc).reduce((a, b) => a + b, 0) || product.quantity,
    });
  };

  const setSameQuantityForAllColors = (productId: string, value: number) => {
    const product = selectedProducts.find((p) => p.product_id === productId);
    if (!product || product.colors.length === 0) return;
    const qpc: Record<string, number> = {};
    product.colors.forEach((k) => { qpc[k] = Math.max(0, value); });
    updateProduct(productId, {
      quantity_per_color: qpc,
      quantity: value * product.colors.length,
    });
  };

  const setQuantityForColor = (productId: string, colorKey: string, value: number) => {
    const product = selectedProducts.find((p) => p.product_id === productId);
    if (!product) return;
    const qpc = getQuantityPerColorOrFallback(product, product.colors);
    qpc[colorKey] = Math.max(0, value);
    const total = Object.values(qpc).reduce((a, b) => a + b, 0);
    updateProduct(productId, {
      quantity_per_color: qpc,
      quantity: total,
    });
  };

  const [perColorExpanded, setPerColorExpanded] = useState<Record<string, boolean>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", () => setSelectedIndex(emblaApi.selectedScrollSnap()));
  }, [emblaApi]);

  const isValid =
    selectedProducts.length > 0 &&
    selectedProducts.every((p) => {
      const catalog = productList.find((c) => c.id === p.product_id);
      const hasColors = (catalog?.available_colors?.length ?? 0) > 0;
      if (hasColors && p.colors.length === 0 && !p.custom_color?.trim()) return false;
      return getTotalQuantity(p) > 0;
    });

  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto min-w-0">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Produtos</h2>
        <p className="text-muted-foreground">
          Selecione os produtos e defina as quantidades por cor
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">
            Clique no card para adicionar:
          </p>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
              <div className="flex touch-pan-y gap-4 pb-2 -ml-4">
                {productList.map((product) => {
                  const selected = isProductSelected(product.id);
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        "flex-[0_0_50%] min-w-0 sm:flex-[0_0_25%] lg:flex-[0_0_20%] pl-4",
                        "snap-center"
                      )}
                    >
                      <Card
                        className={cn(
                          "cursor-pointer transition-all duration-300 rounded-2xl border-2 h-full",
                          selected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-lg scale-[1.02]"
                            : "border-border hover:border-primary/50 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                        )}
                        onClick={() => !selected && addProduct(product)}
                      >
                        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-16 w-16 rounded-xl object-contain bg-muted/50"
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center">
                              <Package className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <p className="font-semibold text-sm">{product.name}</p>
                          {selected && (
                            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                              Adicionado
                            </span>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>

            {productList.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 h-10 w-10 rounded-full border-2 bg-background/95 shadow-md z-10 disabled:opacity-40"
                  onClick={scrollPrev}
                  disabled={prevBtnDisabled}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 h-10 w-10 rounded-full border-2 bg-background/95 shadow-md z-10 disabled:opacity-40"
                  onClick={scrollNext}
                  disabled={nextBtnDisabled}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>

          {productList.length > 1 && (
            <div className="flex justify-center gap-1.5">
              {productList.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    selectedIndex === i ? "w-6 bg-primary" : "w-2 bg-primary/30 hover:bg-primary/50"
                  )}
                  onClick={() => emblaApi?.scrollTo(i)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {selectedProducts.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">
            Produtos selecionados — quantidades por cor
          </p>
          {selectedProducts.map((item) => {
            const catalogProduct = productList.find((p) => p.id === item.product_id);
            const availableColors = catalogProduct?.available_colors ?? [];
            const hasColors = availableColors.length > 0;
            const totalQty = getTotalQuantity(item);
            const qpc = hasColors && item.colors.length > 0
              ? getQuantityPerColorOrFallback(item, item.colors)
              : null;
            const expanded = perColorExpanded[item.product_id] ?? false;

            return (
              <Card key={item.product_id} className="rounded-xl border-2 border-primary/20 overflow-hidden">
                <CardContent className="p-4 md:p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{item.product_name}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => removeProduct(item.product_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {hasColors && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Cores</p>
                        <div className="flex flex-wrap gap-2">
                          {availableColors.map((color) => (
                            <button
                              key={color.key}
                              type="button"
                              onClick={() => toggleColor(item.product_id, color.key)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border-2 transition-colors",
                                item.colors.includes(color.key)
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border hover:border-primary/50"
                              )}
                            >
                              {color.hex && (
                                <span
                                  className="h-3.5 w-3.5 rounded-full border border-border/50"
                                  style={{ backgroundColor: color.hex }}
                                />
                              )}
                              {color.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {catalogProduct?.allows_custom_color && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">Cor personalizada</p>
                        <Input
                          placeholder="Ex: Azul Tiffany, Pantone 485C..."
                          value={item.custom_color || ""}
                          onChange={(e) =>
                            updateProduct(item.product_id, {
                              custom_color: e.target.value || null,
                            })
                          }
                          className="h-9 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {hasColors && item.colors.length > 0 ? (
                    <div className="space-y-3">
                      {!expanded ? (
                        <div className="flex flex-col gap-4 p-3 rounded-lg bg-muted/20 border border-border/50">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="text-xs text-muted-foreground shrink-0">Quantidade por cor (igual para todas):</p>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 shrink-0"
                                  onClick={() => {
                                    const first = Object.values(qpc ?? {})[0] ?? DEFAULT_QTY_PER_COLOR;
                                    setSameQuantityForAllColors(item.product_id, Math.max(1, first - 1));
                                  }}
                                  title={`Diminuir ${item.colors.length} un. (1 por cor)`}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number"
                                  min={1}
                                  value={Object.values(qpc ?? {})[0] ?? ""}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value, 10) || 0;
                                    setSameQuantityForAllColors(item.product_id, v);
                                  }}
                                  className="h-9 w-24 text-center text-sm"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 shrink-0"
                                  onClick={() => {
                                    const first = Object.values(qpc ?? {})[0] ?? DEFAULT_QTY_PER_COLOR;
                                    setSameQuantityForAllColors(item.product_id, first + 1);
                                  }}
                                  title={`Aumentar ${item.colors.length} un. (1 por cor)`}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <p className="text-xs text-muted-foreground">
                                Total: <strong className="text-foreground">{totalQty}</strong> un
                                {item.colors.length > 1 &&
                                  ` (${item.colors.length} cores × ${Object.values(qpc ?? {})[0] ?? 0})`}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 text-sm font-medium border-primary/30 text-foreground hover:bg-primary/5 hover:border-primary/50 w-full sm:w-auto shrink-0"
                                onClick={() => setPerColorExpanded((prev) => ({ ...prev, [item.product_id]: true }))}
                              >
                                <Sliders className="h-4 w-4 opacity-70" />
                                Definir quantidade por cor
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] sm:text-xs text-muted-foreground mr-0.5">Quantidades mais compradas:</span>
                            {QUICK_QUANTITIES.map((q) => {
                              const current = Object.values(qpc ?? {})[0] ?? 0;
                              const isActive = current === q;
                              return (
                                <Button
                                  key={q}
                                  variant="outline"
                                  size="sm"
                                  className={cn(
                                    "h-8 min-w-9 px-3 text-xs font-medium tabular-nums rounded-md border transition-all duration-200",
                                    isActive
                                      ? "border-primary/70 bg-primary/10 text-primary shadow-sm"
                                      : "border-border/50 bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/5"
                                  )}
                                  onClick={() => setSameQuantityForAllColors(item.product_id, q)}
                                >
                                  {q}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-medium text-muted-foreground">Quantidade por cor</p>
                            <div className="flex flex-wrap items-center gap-2">
                              {QUICK_QUANTITIES.map((q) => (
                                <Button
                                  key={q}
                                  variant="outline"
                                  size="sm"
                                  className="h-8 min-w-9 px-3 text-xs font-medium tabular-nums rounded-md border border-border/50 bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-all duration-200"
                                  onClick={() => {
                                    const next: Record<string, number> = {};
                                    item.colors.forEach((k) => { next[k] = q; });
                                    updateProduct(item.product_id, {
                                      quantity_per_color: next,
                                      quantity: q * item.colors.length,
                                    });
                                  }}
                                >
                                  {q}
                                </Button>
                              ))}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 ml-1"
                                onClick={() => setPerColorExpanded((prev) => ({ ...prev, [item.product_id]: false }))}
                              >
                                Usar mesma para todas
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {item.colors.map((colorKey) => {
                              const color = availableColors.find((c) => c.key === colorKey);
                              const qty = (qpc ?? {})[colorKey] ?? 0;
                              return (
                                <div
                                  key={colorKey}
                                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/20 border border-border/50"
                                >
                                  {color?.hex && (
                                    <span
                                      className="h-4 w-4 rounded-full border border-border shrink-0"
                                      style={{ backgroundColor: color.hex }}
                                    />
                                  )}
                                  <span className="text-sm min-w-0 truncate flex-1">{color?.label ?? colorKey}</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setQuantityForColor(item.product_id, colorKey, Math.max(0, qty - 1))}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={qty}
                                      onChange={(e) =>
                                        setQuantityForColor(
                                          item.product_id,
                                          colorKey,
                                          Math.max(0, parseInt(e.target.value, 10) || 0)
                                        )
                                      }
                                      className="h-8 w-20 text-center text-sm"
                                    />
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setQuantityForColor(item.product_id, colorKey, qty + 1)}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Total: <strong>{totalQty}</strong> unidades
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-xs text-muted-foreground">Quantidade:</p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => {
                              const step = Math.max(1, selectedProducts.length);
                              updateProduct(item.product_id, {
                                quantity: Math.max(1, item.quantity - step),
                              });
                            }}
                            title={selectedProducts.length > 1 ? `Diminuir ${selectedProducts.length} un.` : "Diminuir 1 un."}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              updateProduct(item.product_id, {
                                quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                            className="h-9 w-24 text-center text-sm"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => {
                              const step = Math.max(1, selectedProducts.length);
                              updateProduct(item.product_id, {
                                quantity: item.quantity + step,
                              });
                            }}
                            title={selectedProducts.length > 1 ? `Aumentar ${selectedProducts.length} un.` : "Aumentar 1 un."}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] sm:text-xs text-muted-foreground mr-0.5">Quantidades mais compradas:</span>
                        {QUICK_QUANTITIES.map((q) => {
                          const isActive = item.quantity === q;
                          return (
                            <Button
                              key={q}
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-8 min-w-9 px-3 text-xs font-medium tabular-nums rounded-md border transition-all duration-200",
                                isActive
                                  ? "border-primary/70 bg-primary/10 text-primary shadow-sm"
                                  : "border-border/50 bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/5"
                              )}
                              onClick={() => updateProduct(item.product_id, { quantity: q })}
                            >
                              {q}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onNext} disabled={!isValid} className="gap-2 h-11 font-semibold">
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
