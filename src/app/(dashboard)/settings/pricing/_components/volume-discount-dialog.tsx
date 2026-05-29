"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  volumeDiscountSchema,
  SALES_CHANNELS,
  type VolumeDiscountFormData,
} from "@/lib/validations";
import type { PricingVolumeDiscount } from "@/services/pricing.service";

const CHANNEL_LABELS: Record<string, string> = {
  CONSUMIDOR: "Consumidor",
  DENTISTA: "Dentista",
  DISTRIBUIDORA: "Distribuidora",
  VAREJISTA: "Varejista",
};

interface VolumeDiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: PricingVolumeDiscount | null;
  onSubmit: (data: VolumeDiscountFormData) => void;
  isLoading?: boolean;
}

export function VolumeDiscountDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  isLoading,
}: VolumeDiscountDialogProps) {
  const form = useForm<VolumeDiscountFormData>({
    resolver: zodResolver(volumeDiscountSchema),
    defaultValues: {
      channel: "CONSUMIDOR",
      min_order_value: 0,
      discount_pct: 0,
      is_active: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      form.reset({
        channel: initialData.channel,
        min_order_value: Number(initialData.min_order_value),
        discount_pct: Number(initialData.discount_pct),
        is_active: initialData.is_active,
      });
    } else {
      form.reset({
        channel: "CONSUMIDOR",
        min_order_value: 0,
        discount_pct: 0,
        is_active: true,
      });
    }
    // form é estável; evita loop de re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData]);

  const channel = form.watch("channel");
  const isActive = form.watch("is_active");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(28rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Editar desconto" : "Novo desconto por volume"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <div className="space-y-2">
            <Label htmlFor="channel">Canal *</Label>
            <Select
              value={channel}
              onValueChange={(v) =>
                form.setValue("channel", v as VolumeDiscountFormData["channel"])
              }
            >
              <SelectTrigger id="channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SALES_CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CHANNEL_LABELS[c] ?? c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_order_value">Valor mínimo do pedido (R$) *</Label>
            <Input
              id="min_order_value"
              inputMode="decimal"
              {...form.register("min_order_value")}
              placeholder="0,00"
            />
            {form.formState.errors.min_order_value && (
              <p className="text-sm text-destructive">
                {form.formState.errors.min_order_value.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount_pct">Desconto (%) *</Label>
            <Input
              id="discount_pct"
              inputMode="decimal"
              {...form.register("discount_pct")}
              placeholder="0"
            />
            {form.formState.errors.discount_pct && (
              <p className="text-sm text-destructive">
                {form.formState.errors.discount_pct.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="is_active" className="cursor-pointer">
              Ativo
            </Label>
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={(v) => form.setValue("is_active", v)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : initialData ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
