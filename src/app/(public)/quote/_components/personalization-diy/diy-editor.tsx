"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiyPreview } from "./diy-preview";
import { DiyPanel } from "./diy-panel";
import { DiyProductNavigator } from "./diy-product-navigator";
import type {
  WizardPersonalization,
  WizardProductItem,
  WizardClientData,
  DiyCustomization,
} from "../quote-wizard-types";

interface DiyEditorProps {
  products: WizardProductItem[];
  clientData: WizardClientData;
  data: WizardPersonalization;
  onChange: (data: WizardPersonalization) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DiyEditor({
  products,
  clientData,
  data,
  onChange,
  onNext,
  onBack,
}: DiyEditorProps) {
  const [activeProductIndex, setActiveProductIndex] = useState(0);

  useEffect(() => {
    if (!data.diy_customizations || data.diy_customizations.length === 0) {
      const initial: DiyCustomization[] = products.map((p) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        line1: "",
        line2: "",
        logo_file: null,
        logo_preview_url: null,
        print_color: "colorida",
      }));
      onChange({ ...data, diy_customizations: initial });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const customizations = data.diy_customizations || [];
  const currentCustomization = customizations[activeProductIndex];
  const currentProduct = products[activeProductIndex];

  if (!currentCustomization || !currentProduct) return null;

  const updateCurrentCustomization = (updates: Partial<DiyCustomization>) => {
    const updated = customizations.map((c, i) =>
      i === activeProductIndex ? { ...c, ...updates } : c,
    );
    onChange({ ...data, diy_customizations: updated });
  };

  const hasContent = customizations.some(
    (c) => c.line1.trim() || c.line2.trim() || c.logo_file,
  );

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto min-w-0">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Personalize sua escova
        </h2>
        <p className="text-muted-foreground mt-1">
          Edite e veja o resultado em tempo real
        </p>
      </div>

      {products.length > 1 && (
        <DiyProductNavigator
          products={products}
          activeIndex={activeProductIndex}
          onNavigate={setActiveProductIndex}
          customizations={customizations}
        />
      )}

      {/* Split view: Preview + Painel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="order-1">
          <DiyPreview
            customization={currentCustomization}
            product={currentProduct}
          />
        </div>
        <div className="order-2">
          <DiyPanel
            customization={currentCustomization}
            clientData={clientData}
            onChange={updateCurrentCustomization}
          />
        </div>
      </div>

      {/* Copiar para todos */}
      {products.length > 1 && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => {
              const current = customizations[activeProductIndex];
              const updated = customizations.map((c) => ({
                ...c,
                line1: current.line1,
                line2: current.line2,
                logo_file: current.logo_file,
                logo_preview_url: current.logo_preview_url,
                print_color: current.print_color,
              }));
              onChange({ ...data, diy_customizations: updated });
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Aplicar mesma personalização em todos os produtos
          </Button>
        </div>
      )}

      {/* Navegação */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button
          onClick={onNext}
          disabled={!hasContent}
          className="gap-2 h-11 font-semibold"
        >
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
