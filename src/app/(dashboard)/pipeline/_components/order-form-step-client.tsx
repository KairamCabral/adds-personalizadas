"use client";

import { ClientSearch, type SelectedClient } from "./client-search";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderFormStepClientProps {
  currentStep: number;
  selectedClient: SelectedClient | null;
  onClientSelect: (client: SelectedClient | null) => void;
  onNext: () => void;
  onCancel: () => void;
}

const STEPS = [
  { key: 1, label: "Cliente" },
  { key: 2, label: "Produtos" },
  { key: 3, label: "Revisão" },
];

export function OrderFormStepClient({
  currentStep,
  selectedClient,
  onClientSelect,
  onNext,
  onCancel,
}: OrderFormStepClientProps) {
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

      {/* Content */}
      <ClientSearch
        selectedClient={selectedClient}
        onClientSelect={onClientSelect}
      />

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!selectedClient}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Próximo
        </button>
      </div>
    </div>
  );
}
