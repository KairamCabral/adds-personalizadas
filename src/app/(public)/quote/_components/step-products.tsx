"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Hash,
  Minus,
  Palette,
  Plus,
  Trash2,
  Loader2,
  Package,
  Sliders,
  Truck,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getActiveProducts } from "@/services/quotes.service";
import { recalculateQuote } from "@/lib/pricing";
import type { ProductCatalogItem } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WizardProductItem } from "./quote-wizard-types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const DEFAULT_QTY_PER_COLOR = 100;
const QUICK_QUANTITIES = [24, 36, 72, 120];

interface ColorOption {
  key: string;
  label: string;
  hex?: string;
  image_url?: string | null;
}

interface ProductRecord {
  id: string;
  name: string;
  image_url: string | null;
  available_colors?: ColorOption[];
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

  const getValidationMessage = (): string => {
    if (selectedProducts.length === 0) {
      return "Selecione pelo menos um produto para continuar.";
    }
    const issues: string[] = [];
    for (const p of selectedProducts) {
      const catalog = productList.find((c) => c.id === p.product_id);
      const hasColors = (catalog?.available_colors?.length ?? 0) > 0;
      const needsColor = hasColors && p.colors.length === 0 && !p.custom_color?.trim();
      const needsQty = getTotalQuantity(p) <= 0;
      if (needsColor && needsQty) {
        issues.push(`${p.product_name}: selecione a cor e defina a quantidade`);
      } else if (needsColor) {
        issues.push(`${p.product_name}: selecione pelo menos uma cor`);
      } else if (needsQty) {
        issues.push(`${p.product_name}: defina a quantidade`);
      }
    }
    if (issues.length === 0) return "";
    return issues.length === 1
      ? issues[0]
      : "Complete os dados: " + issues.join("; ");
  };

  const handleNext = () => {
    if (!isValid) {
      toast.warning(getValidationMessage(), { duration: 5000 });
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto min-w-0 px-3 sm:px-4">
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
                  className="absolute left-1 sm:left-0 top-1/2 -translate-y-1/2 sm:-translate-x-2 h-9 w-9 sm:h-10 sm:w-10 rounded-full border-2 bg-background/95 shadow-md z-10 disabled:opacity-40"
                  onClick={scrollPrev}
                  disabled={prevBtnDisabled}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-1 sm:right-0 top-1/2 -translate-y-1/2 sm:translate-x-2 h-9 w-9 sm:h-10 sm:w-10 rounded-full border-2 bg-background/95 shadow-md z-10 disabled:opacity-40"
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
                <CardContent className="p-3 sm:p-4 md:p-5 space-y-4 sm:space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <p className="font-bold text-lg truncate">{item.product_name}</p>
                      {(totalQty > 0) && (!hasColors || item.colors.length > 0) && (
                        <Badge variant="secondary" className="shrink-0 text-orange-600 dark:text-orange-400 bg-orange-500/15 border-orange-500/30">
                          <Hash className="h-3 w-3 mr-1" />
                          {totalQty} un
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0 hover:bg-destructive/10"
                      onClick={() => removeProduct(item.product_id)}
                      title="Remover produto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start">
                    {hasColors && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Palette className="h-3.5 w-3.5" />
                          1. Escolha as cores
                        </p>
                        <p className="text-xs text-muted-foreground -mt-2">
                          Clique para selecionar ou remover
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                              {availableColors.map((color) => {
                                const colorWithImg = color as ColorOption;
                                const imgUrl = colorWithImg.image_url ?? null;
                                const isSelected = item.colors.includes(color.key);
                                return (
                                  <button
                                    key={color.key}
                                    type="button"
                                    onClick={() => toggleColor(item.product_id, color.key)}
                                    className={cn(
                                      "relative flex flex-col items-center gap-1.5 p-2 sm:p-2.5 rounded-xl border-2 transition-all min-w-[64px] sm:min-w-[72px]",
                                      isSelected
                                        ? "border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20"
                                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                                    )}
                                  >
                                    {isSelected && (
                                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                        <Check className="h-2.5 w-2.5" />
                                      </span>
                                    )}
                                    {imgUrl ? (
                                      <span className="h-10 w-10 rounded-lg overflow-hidden border border-border/50 shrink-0">
                                        <img
                                          src={imgUrl}
                                          alt={color.label}
                                          className="h-full w-full object-cover"
                                        />
                                      </span>
                                    ) : (
                                      <span
                                        className={cn(
                                          "h-10 w-10 rounded-lg border-2 shrink-0 ring-1 ring-black/5",
                                          !color.hex && "bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400"
                                        )}
                                        style={color.hex ? { backgroundColor: color.hex } : undefined}
                                      />
                                    )}
                                    <span className="text-xs font-medium leading-tight text-center">
                                      {color.label}
                                    </span>
                                  </button>
                                );
                              })}
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

                  {hasColors && item.colors.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center">
                      <p className="text-sm font-medium text-muted-foreground">
                        Selecione pelo menos uma cor acima para definir a quantidade
                      </p>
                    </div>
                  ) : hasColors && item.colors.length > 0 ? (
                    <div className="space-y-3">
                      {!expanded ? (
                        <div className="flex flex-col sm:flex-row gap-4 rounded-xl border border-border/60 bg-muted/10 p-3 sm:p-4">
                          {catalogProduct?.image_url && (
                            <div className="flex flex-col items-center gap-2 shrink-0">
                              <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/30">
                                <img
                                  src={catalogProduct.image_url}
                                  alt={item.product_name}
                                  className="h-20 w-20 sm:h-24 sm:w-24 object-contain"
                                />
                              </div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                2. Quantidade
                              </p>
                            </div>
                          )}
                          <div className={cn("flex-1 min-w-0 space-y-3", !catalogProduct?.image_url && "sm:pl-0")}>
                            {!catalogProduct?.image_url && (
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <Hash className="h-3.5 w-3.5" />
                                2. Quantidade por cor
                              </p>
                            )}
                            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
                              <p className="text-sm text-muted-foreground shrink-0 w-full sm:w-auto">Mesma quantidade em cada cor:</p>
                              <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-10 w-10 shrink-0"
                                  onClick={() => {
                                    const first = Object.values(qpc ?? {})[0] ?? DEFAULT_QTY_PER_COLOR;
                                    setSameQuantityForAllColors(item.product_id, Math.max(1, first - 1));
                                  }}
                                  title={`Diminuir ${item.colors.length} un. (1 por cor)`}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <Input
                                  type="number"
                                  min={1}
                                  value={Object.values(qpc ?? {})[0] ?? ""}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value, 10) || 0;
                                    setSameQuantityForAllColors(item.product_id, v);
                                  }}
                                  className="h-10 w-24 text-center text-base font-semibold tabular-nums"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-10 w-10 shrink-0"
                                  onClick={() => {
                                    const first = Object.values(qpc ?? {})[0] ?? DEFAULT_QTY_PER_COLOR;
                                    setSameQuantityForAllColors(item.product_id, first + 1);
                                  }}
                                  title={`Aumentar ${item.colors.length} un. (1 por cor)`}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                              <span className="text-xs text-muted-foreground shrink-0 pt-1 sm:pt-0">Mais pedidas:</span>
                              <div className="flex flex-wrap gap-2">
                              {QUICK_QUANTITIES.map((q) => {
                                const current = Object.values(qpc ?? {})[0] ?? 0;
                                const isActive = current === q;
                                return (
                                  <Button
                                    key={q}
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                      "min-w-10 px-4 tabular-nums rounded-md border transition-all duration-200",
                                      isActive
                                        ? "h-9 text-base font-bold border-primary bg-primary/15 text-primary shadow-md"
                                        : "h-8 text-xs font-medium border-border/50 bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/5"
                                    )}
                                    onClick={() => setSameQuantityForAllColors(item.product_id, q)}
                                  >
                                    {q}
                                  </Button>
                                );
                              })}
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-3 sm:pt-2 border-t border-border/50">
                              <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2 sm:py-1.5 inline-flex items-baseline gap-2 flex-wrap justify-center sm:justify-start">
                                <span className="text-xs font-medium text-muted-foreground">Total</span>
                                <span className="text-xl font-bold text-orange-600 dark:text-orange-400 tabular-nums">{totalQty}</span>
                                <span className="text-xs text-muted-foreground">unidades selecionadas ({item.colors.length} {item.colors.length === 1 ? "cor" : "cores"})</span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 text-sm font-medium border-primary/30 text-foreground hover:bg-primary/5 hover:border-primary/50 shrink-0 w-full sm:w-auto"
                                onClick={() => setPerColorExpanded((prev) => ({ ...prev, [item.product_id]: true }))}
                              >
                                <Sliders className="h-4 w-4 opacity-70" />
                                Quantidades diferentes
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-4 rounded-xl border border-border/60 bg-muted/10 p-3 sm:p-4">
                          {catalogProduct?.image_url && (
                            <div className="flex flex-col items-center gap-2 shrink-0">
                              <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/30">
                                <img
                                  src={catalogProduct.image_url}
                                  alt={item.product_name}
                                  className="h-20 w-20 sm:h-24 sm:w-24 object-contain"
                                />
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <Sliders className="h-3.5 w-3.5" />
                                Quantidade por cor
                              </p>
                              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                                <span className="text-xs text-muted-foreground shrink-0">Aplicar a todas:</span>
                                <div className="flex flex-wrap gap-2">
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
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10 w-full sm:w-auto"
                                  onClick={() => setPerColorExpanded((prev) => ({ ...prev, [item.product_id]: false }))}
                                >
                                  Igual para todas
                                </Button>
                                </div>
                              </div>
                            </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                            {item.colors.map((colorKey) => {
                              const color = availableColors.find((c) => c.key === colorKey) as ColorOption | undefined;
                              const qty = (qpc ?? {})[colorKey] ?? 0;
                              const colorImg = color && "image_url" in color ? color.image_url : null;
                              return (
                                <div
                                  key={colorKey}
                                  className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg bg-muted/20 border border-border/50 min-w-0"
                                >
                                  {colorImg ? (
                                    <span className="h-8 w-8 rounded-lg overflow-hidden border border-border/50 shrink-0">
                                      <img src={colorImg} alt="" className="h-full w-full object-cover" />
                                    </span>
                                  ) : color?.hex ? (
                                    <span
                                      className="h-8 w-8 rounded-lg border border-border shrink-0"
                                      style={{ backgroundColor: color.hex }}
                                    />
                                  ) : (
                                    <span className="h-8 w-8 rounded-lg border border-border shrink-0 bg-muted" />
                                  )}
                                  <span className="text-sm min-w-0 truncate flex-1 font-medium">{color?.label ?? colorKey}</span>
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
                          <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 sm:px-4 py-2 inline-flex items-baseline gap-2 flex-wrap justify-center sm:justify-start w-full sm:w-auto">
                            <span className="text-sm font-medium text-muted-foreground">Total</span>
                            <span className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400 tabular-nums">{totalQty}</span>
                            <span className="text-xs sm:text-sm text-muted-foreground">unidades selecionadas ({item.colors.length} {item.colors.length === 1 ? "cor" : "cores"})</span>
                          </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
                        <p className="text-xs text-muted-foreground shrink-0">Quantidade:</p>
                        <div className="flex items-center gap-2 justify-center sm:justify-start">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 shrink-0"
                            onClick={() => {
                              const step = Math.max(1, selectedProducts.length);
                              updateProduct(item.product_id, {
                                quantity: Math.max(1, item.quantity - step),
                              });
                            }}
                            title={selectedProducts.length > 1 ? `Diminuir ${selectedProducts.length} un.` : "Diminuir 1 un."}
                          >
                            <Minus className="h-4 w-4" />
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
                            className="h-11 w-28 text-center text-lg font-semibold tabular-nums"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 shrink-0"
                            onClick={() => {
                              const step = Math.max(1, selectedProducts.length);
                              updateProduct(item.product_id, {
                                quantity: item.quantity + step,
                              });
                            }}
                            title={selectedProducts.length > 1 ? `Aumentar ${selectedProducts.length} un.` : "Aumentar 1 un."}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                        <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">Quantidades mais compradas:</span>
                        <div className="flex flex-wrap gap-2">
                        {QUICK_QUANTITIES.map((q) => {
                          const isActive = item.quantity === q;
                          return (
                            <Button
                              key={q}
                              variant="outline"
                              size="sm"
                              className={cn(
                                "min-w-10 px-4 tabular-nums rounded-md border transition-all duration-200",
                                isActive
                                  ? "h-10 text-base font-bold border-primary bg-primary/15 text-primary shadow-md"
                                  : "h-8 text-xs font-medium border-border/50 bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/5"
                              )}
                              onClick={() => updateProduct(item.product_id, { quantity: q })}
                            >
                              {q}
                            </Button>
                          );
                        })}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedProducts.length > 0 && (() => {
        const catalog = productList as unknown as ProductCatalogItem[];
        const quote = recalculateQuote(
          selectedProducts.map((p) => ({
            product_id: p.product_id,
            product_name: p.product_name,
            quantity: p.quantity,
            ...(p.quantity_per_color && Object.keys(p.quantity_per_color).length > 0
              ? { quantity_per_color: p.quantity_per_color }
              : {}),
          })),
          catalog
        );
        if (quote.items.length === 0) return null;
        return (
          <Card className="rounded-xl border-2 border-primary/20 bg-muted/20 overflow-hidden">
            <CardContent className="p-3 sm:p-4 md:p-5 space-y-4">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Resultado do orçamento
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">{formatCurrency(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Desconto PIX/Boleto (5%)</span>
                  <span className="text-green-600 dark:text-green-400 tabular-nums">
                    -{formatCurrency(quote.pixDiscountValue)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">À vista</p>
                  <p className="text-lg font-bold tabular-nums text-primary">
                    {formatCurrency(quote.totalPix)}
                  </p>
                  <p className="text-xs text-muted-foreground">PIX ou Boleto</p>
                </div>
                <div className="rounded-lg bg-muted/50 border border-border p-3 flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">Cartão</p>
                  </div>
                  <p className="text-base font-semibold tabular-nums">
                    4x de {formatCurrency(quote.installment4x)}
                  </p>
                  <p className="text-xs text-muted-foreground">sem juros</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap pt-1">
                {quote.freteGratis ? (
                  <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                    <Check className="h-3 w-3" /> Frete grátis
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400 border-amber-500/50">
                    <Truck className="h-3 w-3" /> Mín. 12 un ou R$ 200 para frete grátis
                  </Badge>
                )}
                {quote.personalizacaoDisponivel ? (
                  <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/30">
                    <Check className="h-3 w-3" /> Personalização grátis
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <X className="h-3 w-3" /> Mín. 24 un ou R$ 480 para personalizar
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4">
        <Button variant="ghost" onClick={onBack} className="gap-2 w-full sm:w-auto order-2 sm:order-1">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={handleNext} className="gap-2 h-11 font-semibold w-full sm:w-auto order-1 sm:order-2">
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
