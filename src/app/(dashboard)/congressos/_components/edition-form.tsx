"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { createEdition, updateEdition } from "@/services/congressos.service";
import { eventEditionSchema, type EventEditionFormData } from "@/lib/validations";
import type { Database, EventEdition } from "@/types/database.types";

type EventEditionInsert =
  Database["public"]["Tables"]["event_editions"]["Insert"];

interface EditionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: EventEdition;
}

const BLANK: EventEditionFormData = {
  name: "",
  slug: "",
  location: "",
  starts_at: "",
  ends_at: "",
  is_active: false,
  turnstile_enabled: true,
  gift_name: "",
  gift_stock: null,
  cashback_enabled: false,
  cashback_type: null,
  cashback_value: null,
  cashback_min_order_value: null,
  cashback_min_order_qty: null,
  cashback_eligibility: null,
  cashback_valid_days: null,
  raffle_enabled: false,
  raffle_eligibility: "ALL",
  raffle_allow_repeat_winners: false,
  raffle_prize: "",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function EditionForm({
  open,
  onOpenChange,
  initialData,
}: EditionFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  const form = useForm<EventEditionFormData>({
    resolver: zodResolver(eventEditionSchema),
    defaultValues: BLANK,
  });

  const cashbackEnabled = form.watch("cashback_enabled");
  const cashbackType = form.watch("cashback_type");
  const raffleEnabled = form.watch("raffle_enabled");

  const createMutation = useMutation({
    mutationFn: (data: EventEditionInsert) => createEdition(data),
    onSuccess: () => {
      toast.success("Edição criada com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["event_editions"] });
      onOpenChange(false);
      form.reset(BLANK);
    },
    onError: () => toast.error("Erro ao criar edição."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EventEditionInsert }) =>
      updateEdition(id, data),
    onSuccess: () => {
      toast.success("Edição atualizada com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["event_editions"] });
      onOpenChange(false);
      form.reset(BLANK);
    },
    onError: () => toast.error("Erro ao atualizar edição."),
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (open && initialData) {
      form.reset({
        name: initialData.name,
        slug: initialData.slug,
        location: initialData.location ?? "",
        starts_at: initialData.starts_at ?? "",
        ends_at: initialData.ends_at ?? "",
        is_active: initialData.is_active,
        turnstile_enabled: initialData.turnstile_enabled,
        gift_name: initialData.gift_name ?? "",
        gift_stock: initialData.gift_stock ?? null,
        cashback_enabled: initialData.cashback_enabled,
        cashback_type: initialData.cashback_type ?? null,
        cashback_value: initialData.cashback_value ?? null,
        cashback_min_order_value: initialData.cashback_min_order_value ?? null,
        cashback_min_order_qty: initialData.cashback_min_order_qty ?? null,
        cashback_eligibility: initialData.cashback_eligibility ?? null,
        cashback_valid_days: initialData.cashback_valid_days ?? null,
        raffle_enabled: initialData.raffle_enabled,
        raffle_eligibility: initialData.raffle_eligibility,
        raffle_allow_repeat_winners: initialData.raffle_allow_repeat_winners,
        raffle_prize: initialData.raffle_prize ?? "",
      });
    } else if (open && !initialData) {
      form.reset(BLANK);
    }
  }, [open, initialData, form]);

  const onSubmit = (data: EventEditionFormData) => {
    const on = data.cashback_enabled;
    const payload: EventEditionInsert = {
      name: data.name,
      slug: data.slug,
      location: data.location?.trim() || null,
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
      is_active: data.is_active,
      turnstile_enabled: data.turnstile_enabled,
      gift_name: data.gift_name?.trim() || null,
      gift_stock: data.gift_stock ?? null,
      cashback_enabled: on,
      cashback_type: on ? data.cashback_type ?? null : null,
      cashback_value: on ? data.cashback_value ?? null : null,
      cashback_min_order_value: on ? data.cashback_min_order_value ?? null : null,
      cashback_min_order_qty: on ? data.cashback_min_order_qty ?? null : null,
      cashback_eligibility: on ? data.cashback_eligibility ?? null : null,
      cashback_valid_days: on ? data.cashback_valid_days ?? null : null,
      raffle_enabled: data.raffle_enabled,
      raffle_eligibility: data.raffle_eligibility,
      raffle_allow_repeat_winners: data.raffle_allow_repeat_winners,
      raffle_prize: data.raffle_prize?.trim() || null,
    };

    if (isEdit) {
      updateMutation.mutate({ id: initialData!.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar edição" : "Nova edição"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Dados */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Ex.: CIOSP 2026"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="slug">Slug *</Label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() =>
                      form.setValue("slug", slugify(form.getValues("name")), {
                        shouldValidate: true,
                      })
                    }
                  >
                    Gerar do nome
                  </button>
                </div>
                <Input
                  id="slug"
                  {...form.register("slug")}
                  placeholder="ciosp-2026"
                />
                {form.formState.errors.slug && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.slug.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Local</Label>
              <Input
                id="location"
                {...form.register("location")}
                placeholder="Ex.: Expo Center Norte, São Paulo"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="starts_at">Início</Label>
                <Input id="starts_at" type="date" {...form.register("starts_at")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ends_at">Término</Label>
                <Input id="ends_at" type="date" {...form.register("ends_at")} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="is_active">Edição ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativa, o pré-cadastro público fica aberto.
                </p>
              </div>
              <Switch
                id="is_active"
                checked={form.watch("is_active")}
                onCheckedChange={(v) => form.setValue("is_active", v)}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="turnstile_enabled">
                  Verificação anti-robô (Turnstile)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Desligue apenas em emergência (falha do Cloudflare no evento).
                </p>
              </div>
              <Switch
                id="turnstile_enabled"
                checked={form.watch("turnstile_enabled")}
                onCheckedChange={(v) => form.setValue("turnstile_enabled", v)}
              />
            </div>
          </div>

          {/* Brinde */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Brinde</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gift_name">Nome do brinde</Label>
                <Input
                  id="gift_name"
                  {...form.register("gift_name")}
                  placeholder="Ex.: Kit escova + creme dental"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gift_stock">Estoque</Label>
                <Controller
                  name="gift_stock"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="gift_stock"
                      type="number"
                      min={0}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                      placeholder="Ilimitado se vazio"
                    />
                  )}
                />
              </div>
            </div>
          </div>

          {/* Cashback */}
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="cashback_enabled">Cashback</Label>
                <p className="text-xs text-muted-foreground">
                  Gera um crédito no cadastro (snapshot das regras desta edição).
                </p>
              </div>
              <Switch
                id="cashback_enabled"
                checked={cashbackEnabled}
                onCheckedChange={(v) =>
                  form.setValue("cashback_enabled", v, { shouldValidate: true })
                }
              />
            </div>

            {cashbackEnabled && (
              <div className="space-y-4 rounded-md border border-dashed p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cashback_type">Tipo *</Label>
                    <Select
                      value={cashbackType ?? ""}
                      onValueChange={(v) =>
                        form.setValue(
                          "cashback_type",
                          v as "PERCENT" | "FIXED",
                          { shouldValidate: true }
                        )
                      }
                    >
                      <SelectTrigger id="cashback_type">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENT">Percentual (%)</SelectItem>
                        <SelectItem value="FIXED">Valor fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.cashback_type && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.cashback_type.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cashback_value">
                      {cashbackType === "PERCENT"
                        ? "Percentual (%) *"
                        : "Valor (R$) *"}
                    </Label>
                    <Controller
                      name="cashback_value"
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          id="cashback_value"
                          type="number"
                          min={0}
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? null
                                : Number(e.target.value)
                            )
                          }
                        />
                      )}
                    />
                    {form.formState.errors.cashback_value && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.cashback_value.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cashback_eligibility">Elegibilidade *</Label>
                    <Select
                      value={form.watch("cashback_eligibility") ?? ""}
                      onValueChange={(v) =>
                        form.setValue(
                          "cashback_eligibility",
                          v as "ALL" | "NEW_ONLY",
                          { shouldValidate: true }
                        )
                      }
                    >
                      <SelectTrigger id="cashback_eligibility">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos os cadastros</SelectItem>
                        <SelectItem value="NEW_ONLY">
                          Somente novos clientes
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.cashback_eligibility && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.cashback_eligibility.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cashback_valid_days">Validade (dias) *</Label>
                    <Controller
                      name="cashback_valid_days"
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          id="cashback_valid_days"
                          type="number"
                          min={1}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? null
                                : Number(e.target.value)
                            )
                          }
                          placeholder="Ex.: 90"
                        />
                      )}
                    />
                    {form.formState.errors.cashback_valid_days && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.cashback_valid_days.message}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Condições de resgate (opcionais) — validadas no momento do uso:
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cashback_min_order_value">
                      Valor mínimo do pedido (R$)
                    </Label>
                    <Controller
                      name="cashback_min_order_value"
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          id="cashback_min_order_value"
                          type="number"
                          min={0}
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? null
                                : Number(e.target.value)
                            )
                          }
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cashback_min_order_qty">
                      Quantidade mínima
                    </Label>
                    <Controller
                      name="cashback_min_order_qty"
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          id="cashback_min_order_qty"
                          type="number"
                          min={0}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? null
                                : Number(e.target.value)
                            )
                          }
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sorteio */}
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="raffle_enabled">Sorteio</Label>
                <p className="text-xs text-muted-foreground">
                  Cada inscrito ganha um número da sorte; você sorteia os
                  ganhadores na tela da edição.
                </p>
              </div>
              <Switch
                id="raffle_enabled"
                checked={raffleEnabled}
                onCheckedChange={(v) => form.setValue("raffle_enabled", v)}
              />
            </div>

            {raffleEnabled && (
              <div className="space-y-4 rounded-md border border-dashed p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="raffle_eligibility">Quem concorre</Label>
                    <Select
                      value={form.watch("raffle_eligibility")}
                      onValueChange={(v) =>
                        form.setValue(
                          "raffle_eligibility",
                          v as "ALL" | "QUALIFIED" | "GIFT_REDEEMED"
                        )
                      }
                    >
                      <SelectTrigger id="raffle_eligibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos os inscritos</SelectItem>
                        <SelectItem value="QUALIFIED">
                          Só qualificados (dentista/distribuidora)
                        </SelectItem>
                        <SelectItem value="GIFT_REDEEMED">
                          Só quem retirou o brinde
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="raffle_prize">Prêmio</Label>
                    <Input
                      id="raffle_prize"
                      {...form.register("raffle_prize")}
                      placeholder="Ex.: Kit premium de higiene bucal"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label htmlFor="raffle_allow_repeat_winners">
                      Permitir ganhar mais de uma vez
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Se desligado, quem já ganhou sai dos próximos sorteios.
                    </p>
                  </div>
                  <Switch
                    id="raffle_allow_repeat_winners"
                    checked={form.watch("raffle_allow_repeat_winners")}
                    onCheckedChange={(v) =>
                      form.setValue("raffle_allow_repeat_winners", v)
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : isEdit ? "Salvar" : "Criar edição"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
