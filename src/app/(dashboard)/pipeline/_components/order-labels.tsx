"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LABELS } from "@/lib/constants";
import type { LabelType } from "@/lib/constants";
import { LabelBadge } from "@/components/shared/label-badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { addLabel, removeLabel } from "@/services/orders.service";
import { Tag, Check } from "lucide-react";
import { toast } from "sonner";

interface OrderLabelsProps {
  orderId: string;
  currentLabels: { id: string; label: LabelType }[];
  canEdit?: boolean;
}

export function OrderLabels({ orderId, currentLabels, canEdit = true }: OrderLabelsProps) {
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (label: LabelType) => addLabel(orderId, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Etiqueta adicionada.");
    },
    onError: () => {
      toast.error("Erro ao adicionar etiqueta.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (labelId: string) => removeLabel(labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Etiqueta removida.");
    },
    onError: () => {
      toast.error("Erro ao remover etiqueta.");
    },
  });

  const currentLabelKeys = new Set(currentLabels.map((l) => l.label));
  const isPending = addMutation.isPending || removeMutation.isPending;

  function toggleLabel(label: LabelType) {
    const existing = currentLabels.find((l) => l.label === label);
    if (existing) {
      removeMutation.mutate(existing.id);
    } else {
      addMutation.mutate(label);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {currentLabels.map((l) => (
        <LabelBadge
          key={l.id}
          label={l.label}
          size="md"
          onRemove={
            canEdit && !isPending ? () => removeMutation.mutate(l.id) : undefined
          }
        />
      ))}
      {canEdit && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="default" disabled={isPending} className="h-9">
              <Tag className="h-4 w-4" />
              {currentLabels.length > 0 ? "Editar etiquetas" : "Adicionar etiqueta"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Etiquetas disponíveis
            </p>
            <div className="mt-1 space-y-0.5">
              {LABELS.map((config) => {
                const isActive = currentLabelKeys.has(config.key);
                return (
                  <button
                    key={config.key}
                    type="button"
                    onClick={() => toggleLabel(config.key)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    {isActive ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <span className="h-4 w-4 shrink-0" />
                    )}
                    <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
