"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPricingSettings,
  updatePricingSettings,
} from "@/services/pricing.service";
import {
  pricingSettingsSchema,
  type PricingSettingsFormData,
} from "@/lib/validations";

export function PricingSettingsSection() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["pricing-settings"],
    queryFn: getPricingSettings,
  });

  const form = useForm<PricingSettingsFormData>({
    resolver: zodResolver(pricingSettingsSchema),
    defaultValues: {
      avista_discount_pct: 0,
      min_order_distribuidora: 0,
      min_order_varejista: 0,
      valid_until: null,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        avista_discount_pct: Number(settings.avista_discount_pct),
        min_order_distribuidora: Number(settings.min_order_distribuidora),
        min_order_varejista: Number(settings.min_order_varejista),
        valid_until: settings.valid_until ?? null,
      });
    }
    // form é estável; evita loop de re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: PricingSettingsFormData) =>
      updatePricingSettings({
        avista_discount_pct: data.avista_discount_pct,
        min_order_distribuidora: data.min_order_distribuidora,
        min_order_varejista: data.min_order_varejista,
        valid_until: data.valid_until ?? null,
      }),
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["pricing-settings"] });
    },
    onError: () => toast.error("Erro ao salvar configurações."),
  });

  if (isLoading) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        Carregando configurações...
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
      className="max-w-lg space-y-5 rounded-lg border border-border p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="avista_discount_pct">Desconto à vista (%)</Label>
        <Input
          id="avista_discount_pct"
          inputMode="decimal"
          {...form.register("avista_discount_pct")}
          placeholder="0"
        />
        {form.formState.errors.avista_discount_pct && (
          <p className="text-sm text-destructive">
            {form.formState.errors.avista_discount_pct.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="min_order_distribuidora">
          Pedido mínimo — Distribuidora (R$)
        </Label>
        <Input
          id="min_order_distribuidora"
          inputMode="decimal"
          {...form.register("min_order_distribuidora")}
          placeholder="0,00"
        />
        {form.formState.errors.min_order_distribuidora && (
          <p className="text-sm text-destructive">
            {form.formState.errors.min_order_distribuidora.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="min_order_varejista">
          Pedido mínimo — Varejista (R$)
        </Label>
        <Input
          id="min_order_varejista"
          inputMode="decimal"
          {...form.register("min_order_varejista")}
          placeholder="0,00"
        />
        {form.formState.errors.min_order_varejista && (
          <p className="text-sm text-destructive">
            {form.formState.errors.min_order_varejista.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="valid_until">Tabela válida até</Label>
        <Input
          id="valid_until"
          type="date"
          {...form.register("valid_until")}
        />
        <p className="text-xs text-muted-foreground">
          Opcional. Data de validade da tabela de preços vigente.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </form>
  );
}
