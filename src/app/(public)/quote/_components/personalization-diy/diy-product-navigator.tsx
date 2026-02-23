"use client";

import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  WizardProductItem,
  DiyCustomization,
} from "../quote-wizard-types";

interface DiyProductNavigatorProps {
  products: WizardProductItem[];
  activeIndex: number;
  onNavigate: (index: number) => void;
  customizations: DiyCustomization[];
}

export function DiyProductNavigator({
  products,
  activeIndex,
  onNavigate,
  customizations,
}: DiyProductNavigatorProps) {
  const isCustomized = (index: number) => {
    const c = customizations[index];
    return c && (c.line1.trim() || c.line2.trim() || c.logo_file);
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onNavigate(Math.max(0, activeIndex - 1))}
        disabled={activeIndex === 0}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1.5 overflow-x-auto">
        {products.map((product, index) => (
          <button
            key={product.product_id}
            type="button"
            onClick={() => onNavigate(index)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
              index === activeIndex
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {isCustomized(index) && <Check className="h-3 w-3" />}
            {product.product_name}
          </button>
        ))}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() =>
          onNavigate(Math.min(products.length - 1, activeIndex + 1))
        }
        disabled={activeIndex === products.length - 1}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
