"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useUIStore } from "@/stores/ui.store";
import { OrderFormStepClient } from "./order-form-step-client";
import { OrderFormStepProducts } from "./order-form-step-products";
import { OrderFormStepReview } from "./order-form-step-review";
import type { SelectedClient } from "./client-search";
import type { OrderFormItem } from "./order-form-step-products";

interface OrderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_FORM_DATA = {
  selectedClient: null as SelectedClient | null,
  items: [] as OrderFormItem[],
  personalizationNotes: "",
  logoFile: null as File | null,
  logoPreviewUrl: null as string | null,
  priority: "NORMAL" as "NORMAL" | "ALTA",
};

export function OrderForm({ open, onOpenChange }: OrderFormProps) {
  const { setSelectedOrderId, setCreateOrderStatus } = useUIStore();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setFormData(DEFAULT_FORM_DATA);
      setCreateOrderStatus(null);
    }
  }, [open, setCreateOrderStatus]);

  const handleClientSelect = (client: SelectedClient | null) => {
    setFormData((prev) => ({ ...prev, selectedClient: client }));
  };

  const handleItemsChange = (items: OrderFormItem[]) => {
    setFormData((prev) => ({ ...prev, items }));
  };

  const handlePersonalizationChange = (notes: string) => {
    setFormData((prev) => ({ ...prev, personalizationNotes: notes }));
  };

  const handleLogoChange = (file: File | null, previewUrl: string | null) => {
    setFormData((prev) => ({ ...prev, logoFile: file, logoPreviewUrl: previewUrl }));
  };

  const handlePriorityChange = (priority: "NORMAL" | "ALTA") => {
    setFormData((prev) => ({ ...prev, priority }));
  };

  const handleCreateSuccess = (orderId: string) => {
    setSelectedOrderId(orderId);
    onOpenChange(false);
    setCurrentStep(1);
    setFormData(DEFAULT_FORM_DATA);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setCreateOrderStatus(null);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-lg sm:max-w-xl md:max-w-2xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Novo pedido</DialogTitle>
          <DialogDescription>
            Preencha os dados do pedido em 3 passos
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto flex-1 -mx-1 px-1">
        {currentStep === 1 && (
          <OrderFormStepClient
            currentStep={1}
            selectedClient={formData.selectedClient}
            onClientSelect={handleClientSelect}
            onNext={() => setCurrentStep(2)}
            onCancel={() => onOpenChange(false)}
          />
        )}

        {currentStep === 2 && (
          <OrderFormStepProducts
            currentStep={2}
            selectedClient={formData.selectedClient}
            items={formData.items}
            personalizationNotes={formData.personalizationNotes}
            logoFile={formData.logoFile}
            logoPreviewUrl={formData.logoPreviewUrl}
            onItemsChange={handleItemsChange}
            onPersonalizationChange={handlePersonalizationChange}
            onLogoChange={handleLogoChange}
            onBack={() => setCurrentStep(1)}
            onNext={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 3 && (
          <OrderFormStepReview
            currentStep={3}
            selectedClient={formData.selectedClient}
            items={formData.items}
            personalizationNotes={formData.personalizationNotes}
            logoFile={formData.logoFile}
            logoPreviewUrl={formData.logoPreviewUrl}
            priority={formData.priority}
            onPriorityChange={handlePriorityChange}
            onBack={() => setCurrentStep(2)}
            onCreateSuccess={handleCreateSuccess}
          />
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
