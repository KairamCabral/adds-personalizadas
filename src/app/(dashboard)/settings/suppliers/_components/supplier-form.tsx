"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { Supplier } from "@/types/database.types";

const supplierSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  contact_name: z.string().optional(),
  contact_email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  bling_api_token: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

interface SupplierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
  onSubmit: (data: SupplierFormData) => Promise<void>;
}

export function SupplierForm({
  open,
  onOpenChange,
  supplier,
  onSubmit,
}: SupplierFormProps) {
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      bling_api_token: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: supplier?.name ?? "",
        contact_name: supplier?.contact_name ?? "",
        contact_email: supplier?.contact_email ?? "",
        contact_phone: supplier?.contact_phone ?? "",
        bling_api_token: supplier?.bling_api_token ?? "",
      });
    }
  }, [open, supplier, form]);

  const token = form.watch("bling_api_token");

  async function handleTestConnection() {
    if (!token?.trim()) {
      setTestResult({ success: false, message: "Informe o token para testar." });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/bling/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiToken: token.trim() }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
    } catch {
      setTestResult({ success: false, message: "Erro de conexão" });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSubmit(data: SupplierFormData) {
    await onSubmit(data);
    onOpenChange(false);
    form.reset();
    setTestResult(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {supplier ? "Editar fornecedor" : "Novo fornecedor"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Nome do fornecedor</Label>
            <Input
              id="name"
              placeholder="Ex: Fornecedor XYZ"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_name">Nome do contato</Label>
            <Input
              id="contact_name"
              placeholder="Pessoa de contato"
              {...form.register("contact_name")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">E-mail do contato</Label>
            <Input
              id="contact_email"
              type="email"
              placeholder="contato@fornecedor.com"
              {...form.register("contact_email")}
            />
            {form.formState.errors.contact_email && (
              <p className="text-xs text-destructive">
                {form.formState.errors.contact_email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_phone">Telefone do contato</Label>
            <Input
              id="contact_phone"
              placeholder="(11) 99999-9999"
              {...form.register("contact_phone")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bling_api_token">Token API do Bling</Label>
            <div className="flex gap-2">
              <Input
                id="bling_api_token"
                type="password"
                placeholder="Token da API Bling"
                {...form.register("bling_api_token")}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Testar"
                )}
              </Button>
            </div>
            {testResult && (
              <div
                className={`flex items-center gap-2 text-xs ${
                  testResult.success ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Conexão OK
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    {testResult.message}
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {supplier ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
