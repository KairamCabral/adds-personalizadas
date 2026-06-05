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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient, updateClient } from "@/services/clients.service";
import { clientSchema, type ClientFormData } from "@/lib/validations";
import {
  SALES_CHANNEL_LABELS,
  SALES_CHANNEL_VALUES,
} from "@/lib/sales-channel";
import { formatPhoneInput, formatDocumentInput } from "@/lib/utils";
import type { Client } from "@/types/database.types";
import { RefreshCw } from "lucide-react";

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Client;
}

export function ContactForm({
  open,
  onOpenChange,
  initialData,
}: ContactFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      person_type: "FISICA",
      name: "",
      email: "",
      phone: "",
      company: "",
      document: "",
      notes: "",
      zip_code: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      sales_channel: null,
    },
  });

  const NO_CHANNEL = "__none__";

  const createMutation = useMutation({
    mutationFn: async (data: Parameters<typeof createClient>[0]) => {
      const docDigits = (data.document ?? "").replace(/\D/g, "");
      if (docDigits.length >= 11) {
        const res = await fetch(
          `/api/clients/find-by-document?document=${encodeURIComponent(data.document ?? "")}`
        );
        const { client } = await res.json();
        if (client) {
          const err = new Error("DUPLICATE_DOCUMENT") as Error & { code?: string };
          err.code = "DUPLICATE_DOCUMENT";
          throw err;
        }
      }
      return createClient(data);
    },
    onSuccess: () => {
      toast.success("Contato criado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === "DUPLICATE_DOCUMENT") {
        toast.error("Já existe um cliente com este CPF/CNPJ.");
      } else {
        toast.error("Erro ao criar contato.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) =>
      updateClient(id, data),
    onSuccess: () => {
      toast.success("Contato atualizado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast.error("Erro ao atualizar contato.");
    },
  });

  const syncFromTinyMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const res = await fetch(`/api/clients/${clientId}/sync-from-tiny`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Erro ao sincronizar com Tiny");
      }
      return json as {
        success: boolean;
        client?: Client;
        fieldsUpdated?: string[];
      };
    },
    onSuccess: (data) => {
      const fields = data.fieldsUpdated ?? [];
      const fieldsCount = fields.length;
      if (fieldsCount > 0) {
        toast.success("Atualizado do Tiny", {
          description: `${fieldsCount} campo(s) atualizado(s): ${fields.join(", ")}`,
        });
      } else {
        toast.success("Já estava atualizado");
      }
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      if (data.client) {
        const c = data.client;
        const doc = c.document ?? "";
        const phone = c.phone ?? "";
        form.reset({
          person_type: c.person_type,
          name: c.name,
          email: c.email ?? "",
          phone: phone ? formatPhoneInput(phone) : "",
          company: c.company ?? "",
          document: doc ? formatDocumentInput(doc) : "",
          notes: c.notes ?? "",
          zip_code: c.zip_code ?? "",
          street: c.street ?? "",
          number: c.number ?? "",
          complement: c.complement ?? "",
          neighborhood: c.neighborhood ?? "",
          city: c.city ?? "",
          state: c.state ?? "",
          sales_channel: c.sales_channel ?? null,
        });
      }
    },
    onError: (err: Error) => {
      toast.error("Erro ao sincronizar do Tiny", {
        description: err.message,
      });
    },
  });

  const isLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    syncFromTinyMutation.isPending;

  useEffect(() => {
    if (open && initialData) {
      const doc = initialData.document ?? "";
      const phone = initialData.phone ?? "";
      form.reset({
        person_type: initialData.person_type,
        name: initialData.name,
        email: initialData.email ?? "",
        phone: phone ? formatPhoneInput(phone) : "",
        company: initialData.company ?? "",
        document: doc ? formatDocumentInput(doc) : "",
        notes: initialData.notes ?? "",
        zip_code: initialData.zip_code ?? "",
        street: initialData.street ?? "",
        number: initialData.number ?? "",
        complement: initialData.complement ?? "",
        neighborhood: initialData.neighborhood ?? "",
        city: initialData.city ?? "",
        state: initialData.state ?? "",
        sales_channel: initialData.sales_channel ?? null,
      });
    } else if (open && !initialData) {
      form.reset({
        person_type: "FISICA",
        name: "",
        email: "",
        phone: "",
        company: "",
        document: "",
        notes: "",
        zip_code: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        sales_channel: null,
      });
    }
  }, [open, initialData, form]);

  const onSubmit = (data: ClientFormData) => {
    const basePayload = {
      person_type: data.person_type,
      name: data.name,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      company: data.company?.trim() || null,
      document: data.document?.trim() || null,
      notes: data.notes?.trim() || null,
      zip_code: data.zip_code?.trim() || null,
      street: data.street?.trim() || null,
      number: data.number?.trim() || null,
      complement: data.complement?.trim() || null,
      neighborhood: data.neighborhood?.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      sales_channel: data.sales_channel ?? null,
    };

    if (isEdit) {
      updateMutation.mutate({ id: initialData!.id, data: basePayload });
    } else {
      createMutation.mutate({
        ...basePayload,
        country: "Brasil",
        logo_url: null,
        tiny_id: null,
        tiny_synced_at: null,
        created_by: null,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar contato" : "Novo contato"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="person_type">Tipo de pessoa</Label>
                <Select
                  value={form.watch("person_type")}
                  onValueChange={(v) =>
                    form.setValue("person_type", v as "FISICA" | "JURIDICA")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FISICA">Pessoa Física</SelectItem>
                    <SelectItem value="JURIDICA">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Nome completo ou razão social"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register("email")}
                  placeholder="email@exemplo.com"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Controller
                  name="phone"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="phone"
                      {...field}
                      value={field.value ?? ""}
                      placeholder="(00) 00000-0000"
                      onChange={(e) =>
                        field.onChange(formatPhoneInput(e.target.value))
                      }
                    />
                  )}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Input
                  id="company"
                  {...form.register("company")}
                  placeholder="Nome da empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="document">
                  {form.watch("person_type") === "FISICA" ? "CPF" : "CNPJ"}
                </Label>
                <Controller
                  name="document"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="document"
                      {...field}
                      value={field.value ?? ""}
                      placeholder={
                        form.watch("person_type") === "FISICA"
                          ? "000.000.000-00"
                          : "00.000.000/0001-00"
                      }
                      onChange={(e) =>
                        field.onChange(formatDocumentInput(e.target.value))
                      }
                    />
                  )}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sales_channel">Canal de venda</Label>
                <Select
                  value={form.watch("sales_channel") ?? NO_CHANNEL}
                  onValueChange={(v) =>
                    form.setValue(
                      "sales_channel",
                      v === NO_CHANNEL
                        ? null
                        : (v as (typeof SALES_CHANNEL_VALUES)[number])
                    )
                  }
                >
                  <SelectTrigger id="sales_channel">
                    <SelectValue placeholder="Não definido" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHANNEL}>Não definido</SelectItem>
                    {SALES_CHANNEL_VALUES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {SALES_CHANNEL_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                {...form.register("notes")}
                placeholder="Anotações sobre o contato"
                rows={3}
              />
            </div>
          </div>

          {isEdit &&
            initialData?.tiny_id &&
            (!form.watch("street") ||
              !form.watch("city") ||
              !form.watch("zip_code")) && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/20">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  Endereço incompleto
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Esse contato veio do Tiny mas alguns campos de endereço estão
                  vazios. Clique em &quot;Atualizar do Tiny&quot; pra buscar os
                  dados atuais.
                </p>
              </div>
            )}

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Endereço</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="zip_code">CEP</Label>
                <Input
                  id="zip_code"
                  {...form.register("zip_code")}
                  placeholder="00000-000"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="street">Rua</Label>
                <Input
                  id="street"
                  {...form.register("street")}
                  placeholder="Rua, avenida..."
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  {...form.register("number")}
                  placeholder="Nº"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  {...form.register("complement")}
                  placeholder="Apto, sala..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  {...form.register("neighborhood")}
                  placeholder="Bairro"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  {...form.register("city")}
                  placeholder="Cidade"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  {...form.register("state")}
                  placeholder="UF"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <div className="flex-1">
              {isEdit && initialData?.tiny_id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => syncFromTinyMutation.mutate(initialData.id)}
                  disabled={syncFromTinyMutation.isPending || isLoading}
                  className="gap-2"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${syncFromTinyMutation.isPending ? "animate-spin" : ""}`}
                  />
                  {syncFromTinyMutation.isPending
                    ? "Atualizando..."
                    : "Atualizar do Tiny"}
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading && !syncFromTinyMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
              >
                {isLoading && !syncFromTinyMutation.isPending
                  ? "Salvando..."
                  : isEdit
                    ? "Salvar"
                    : "Criar contato"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
