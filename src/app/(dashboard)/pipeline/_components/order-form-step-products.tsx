// @ts-nocheck
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActiveProducts } from "@/services/products.service";
import { ProductSelector } from "./product-selector";
import { LogoUpload } from "./logo-upload";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/database.types";
import type { SelectedClient } from "./client-search";
import type { ColorOption } from "./color-picker";

/** Quantidade por cor: { branco: 5, azul: 3 } */
export type ColorQuantities = Record<string, number>;

export interface OrderFormItem {
  product_id: string;
  product_name: string;
  product: Product;
  colorQuantities: ColorQuantities;
  custom_color: string | null;
  replicateQuantity: boolean;
}

interface OrderFormStepProductsProps {
  currentStep: number;
  selectedClient: SelectedClient | null;
  items: OrderFormItem[];
  personalizationNotes: string;
  logoFile: File | null;
  logoPreviewUrl: string | null;
  onItemsChange: (items: OrderFormItem[]) => void;
  onPersonalizationChange: (notes: string) => void;
  onLogoChange: (file: File | null, previewUrl: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}

const STEPS = [
  { key: 1, label: "Cliente" },
  { key: 2, label: "Produtos" },
  { key: 3, label: "Revisão" },
];

export function OrderFormStepProducts({
  currentStep,
  selectedClient,
  items,
  personalizationNotes,
  logoFile,
  logoPreviewUrl,
  onItemsChange,
  onPersonalizationChange,
  onLogoChange,
  onBack,
  onNext,
}: OrderFormStepProductsProps) {
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["products", "active"],
    queryFn: getActiveProducts,
  });

  const availableToAdd = products.filter(
    (p) => !items.some((i) => i.product_id === p.id)
  );

  const addProduct = (product: Product) => {
    const colors = parseAvailableColors(product);
    const firstKey = colors.length > 0 ? colors[0].key : "branco";
    onItemsChange([
      ...items,
      {
        product_id: product.id,
        product_name: product.name,
        product,
        colorQuantities: { [firstKey]: 1 },
        custom_color: null,
        replicateQuantity: true,
      },
    ]);
    setProductPopoverOpen(false);
  };

  const updateItem = (index: number, updates: Partial<OrderFormItem>) => {
    const next = [...items];
    next[index] = { ...next[index], ...updates };
    onItemsChange(next);
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const canProceed =
    items.length >= 1 &&
    items.every((i) => Object.keys(i.colorQuantities).length >= 1);

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                step.key < currentStep &&
                  "bg-green-500/20 text-green-600 dark:text-green-400",
                step.key === currentStep &&
                  "bg-primary text-primary-foreground",
                step.key > currentStep &&
                  "border border-border bg-muted/50 text-muted-foreground"
              )}
            >
              {step.key < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                step.key
              )}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                step.key === currentStep
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="mx-1 h-px w-6 bg-border" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      {/* Client card */}
      {selectedClient && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-2">
          <p className="text-xs font-medium text-muted-foreground">Cliente</p>
          <p className="font-medium text-foreground">{selectedClient.name}</p>
          {selectedClient.phone && (
            <p className="text-sm text-muted-foreground">
              {selectedClient.phone}
            </p>
          )}
        </div>
      )}

      {/* Products */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Produtos</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Adicione os itens do pedido e escolha as opções de cada um
          </p>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <ProductSelector
              key={item.product_id}
              product={item.product}
              colorQuantities={item.colorQuantities}
              customColor={item.custom_color}
              replicateQuantity={item.replicateQuantity}
              onColorQuantitiesChange={(colorQuantities, customColor) =>
                updateItem(index, { colorQuantities, custom_color: customColor })
              }
              onReplicateQuantityChange={(replicateQuantity) =>
                updateItem(index, { replicateQuantity })
              }
              onRemove={() => removeItem(index)}
            />
          ))}
        </div>
        <Popover
          open={productPopoverOpen}
          onOpenChange={setProductPopoverOpen}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full justify-center border-dashed py-6 hover:border-primary/50 hover:bg-primary/5"
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar outro produto
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar produto..." />
              <CommandList>
                <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                <CommandGroup>
                  {availableToAdd.map((p) => (
                    <CommandItem
                      key={p.id}
                      onSelect={() => addProduct(p)}
                    >
                      {p.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {items.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Adicione pelo menos 1 produto
          </p>
        )}
      </div>

      {/* Personalization */}
      <div>
        <p className="mb-2 text-sm font-medium">Detalhes da personalização</p>
        <Textarea
          placeholder="Descreva os detalhes: textos, posicionamento, observações..."
          value={personalizationNotes}
          onChange={(e) => onPersonalizationChange(e.target.value)}
          rows={4}
          className="resize-none"
        />
      </div>

      {/* Logo */}
      <div>
        <p className="mb-2 text-sm font-medium">Logo do cliente</p>
        <LogoUpload
          file={logoFile}
          previewUrl={logoPreviewUrl}
          onFileChange={(f) => {
            let url: string | null = null;
            if (f && f.type.startsWith("image/")) {
              url = URL.createObjectURL(f);
            }
            onLogoChange(f, url);
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          ← Voltar
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Próximo
        </button>
      </div>
    </div>
  );
}

function parseAvailableColors(product: Product): ColorOption[] {
  const raw = (product as any).available_colors;
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as ColorOption[]).filter(
    (c) => c && typeof c.key === "string" && typeof c.label === "string"
  );
}
