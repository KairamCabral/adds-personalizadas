// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { getActiveProducts } from "@/services/products.service";
import type { Product } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Minus, Plus, Package } from "lucide-react";

export interface QuoteItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface StepProductsProps {
  initialItems?: QuoteItem[];
  onNext: (items: QuoteItem[], total: number) => void;
  onBack: () => void;
}

export function StepProducts({ initialItems = [], onNext, onBack }: StepProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const item of initialItems) {
      map[item.product_id] = item.quantity;
    }
    return map;
  });
  const [manualPrices, setManualPrices] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const item of initialItems) {
      map[item.product_id] = item.unit_price;
    }
    return map;
  });

  useEffect(() => {
    getActiveProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  const handleUpdateQuantity = (productId: string, delta: number) => {
    const current = selected[productId] ?? 0;
    const next = Math.max(0, current + delta);
    if (next === 0) {
      setSelected((prev) => {
        const { [productId]: _, ...rest } = prev;
        return rest;
      });
    } else {
      setSelected((prev) => ({ ...prev, [productId]: next }));
    }
  };

  const getUnitPrice = (product: Product): number => {
    if (product.price != null && product.price > 0) {
      return Number(product.price);
    }
    return manualPrices[product.id] ?? 0;
  };

  const items: QuoteItem[] = Object.entries(selected)
    .filter(([, qty]) => qty > 0)
    .map(([productId, quantity]) => {
      const product = products.find((p) => p.id === productId)!;
      const unitPrice = getUnitPrice(product);
      return {
        product_id: productId,
        product_name: product.name,
        quantity,
        unit_price: unitPrice,
      };
    });

  const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  const canProceed =
    items.length > 0 &&
    items.every((item) => {
      const product = products.find((p) => p.id === item.product_id)!;
      return getUnitPrice(product) > 0;
    });

  const handleNext = () => {
    const quoteItems: QuoteItem[] = Object.entries(selected)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => {
        const product = products.find((p) => p.id === productId)!;
        return {
          product_id: productId,
          product_name: product.name,
          quantity,
          unit_price: getUnitPrice(product),
        };
      });
    onNext(quoteItems, total);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Carregando produtos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((product) => {
          const hasPrice = product.price != null && product.price > 0;
          const unitPrice = getUnitPrice(product);
          const qty = selected[product.id] ?? 0;

          return (
            <Card key={product.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{product.name}</CardTitle>
                {product.description && (
                  <CardDescription className="line-clamp-2">
                    {product.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {hasPrice ? (
                  <span className="font-semibold text-foreground">
                    {formatCurrency(Number(product.price))}
                  </span>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Preço unitário (R$)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={manualPrices[product.id] || ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(",", "."));
                        setManualPrices((prev) => ({
                          ...prev,
                          [product.id]: isNaN(val) ? 0 : val,
                        }));
                      }}
                      className="max-w-[120px]"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleUpdateQuantity(product.id, -1)}
                    disabled={qty === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[2rem] text-center font-medium">
                    {qty}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleUpdateQuantity(product.id, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {items.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Resumo
            </CardTitle>
            <CardDescription>
              {items.length} produto(s) selecionado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.product_id} className="flex justify-between text-sm">
                  <span>
                    {item.product_name} x {item.quantity}
                  </span>
                  <span>{formatCurrency(item.unit_price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 font-semibold">
              Total: {formatCurrency(total)}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canProceed}
        >
          Próximo
        </Button>
      </div>
    </div>
  );
}
