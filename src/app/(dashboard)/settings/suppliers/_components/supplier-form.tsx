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
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Link2,
  AlertCircle,
} from "lucide-react";
import type { Supplier } from "@/types/database.types";

const supplierSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  contact_name: z.string().optional(),
  contact_email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  bling_client_id: z.string().optional(),
  bling_client_secret: z.string().optional(),
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
  const [isConnecting, setIsConnecting] = useState(false);

  const isConnected = !!(
    supplier?.bling_access_token && supplier?.bling_token_expires_at
  );
  const tokenExpiry = supplier?.bling_token_expires_at
    ? new Date(supplier.bling_token_expires_at)
    : null;
  const isTokenExpired = tokenExpiry ? tokenExpiry.getTime() < Date.now() : false;

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      bling_client_id: "",
      bling_client_secret: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: supplier?.name ?? "",
        contact_name: supplier?.contact_name ?? "",
        contact_email: supplier?.contact_email ?? "",
        contact_phone: supplier?.contact_phone ?? "",
        bling_client_id: supplier?.bling_client_id ?? "",
        bling_client_secret: supplier?.bling_client_secret ?? "",
      });
    }
  }, [open, supplier, form]);

  async function handleSubmit(data: SupplierFormData) {
    await onSubmit(data);
    onOpenChange(false);
    form.reset();
  }

  function handleConnectBling() {
    if (!supplier?.id) return;
    setIsConnecting(true);
    window.location.href = `/api/bling/oauth/start?supplier_id=${supplier.id}`;
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

          {/* Integração Bling OAuth 2.0 */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Integração Bling</Label>
              {supplier?.id && (
                <ConnectionBadge
                  isConnected={isConnected}
                  isExpired={isTokenExpired}
                />
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Insira as credenciais do seu app Bling.{" "}
              <a
                href="https://developer.bling.com.br/aplicativos"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline text-primary hover:no-underline"
              >
                Criar app no Bling
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>

            <div className="space-y-2">
              <Label htmlFor="bling_client_id" className="text-xs">
                Client ID
              </Label>
              <Input
                id="bling_client_id"
                placeholder="Client ID do aplicativo Bling"
                {...form.register("bling_client_id")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bling_client_secret" className="text-xs">
                Client Secret
              </Label>
              <Input
                id="bling_client_secret"
                type="password"
                placeholder="Client Secret do aplicativo Bling"
                {...form.register("bling_client_secret")}
              />
            </div>

            {supplier?.id ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                  Salve as credenciais e clique em "Conectar com Bling" para autorizar o acesso.
                  O Bling redirecionará de volta automaticamente.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleConnectBling}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  {isConnected && !isTokenExpired
                    ? "Reconectar com Bling"
                    : "Conectar com Bling"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                Salve o fornecedor primeiro para poder conectar ao Bling.
              </p>
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

function ConnectionBadge({
  isConnected,
  isExpired,
}: {
  isConnected: boolean;
  isExpired: boolean;
}) {
  if (isConnected && !isExpired) {
    return (
      <Badge variant="secondary" className="gap-1 text-emerald-700 bg-emerald-50 border-emerald-200">
        <CheckCircle2 className="h-3 w-3" />
        Conectado
      </Badge>
    );
  }
  if (isConnected && isExpired) {
    return (
      <Badge variant="secondary" className="gap-1 text-amber-700 bg-amber-50 border-amber-200">
        <AlertCircle className="h-3 w-3" />
        Token expirado
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-muted-foreground">
      <XCircle className="h-3 w-3" />
      Não conectado
    </Badge>
  );
}
