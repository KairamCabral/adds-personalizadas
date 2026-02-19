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
import { formatPhoneInput, formatDocumentInput } from "@/lib/utils";
import type { Client } from "@/types/database.types";

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
    },
  });

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

  const isLoading = createMutation.isPending || updateMutation.isPending;

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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : isEdit ? "Salvar" : "Criar contato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
