"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MoreHorizontal, Pencil, Eye, Truck, Boxes } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSuppliers, deactivateSupplier } from "@/services/suppliers.service";
import { AgreementStatus } from "./_components/agreement-status";
import { SupplierForm } from "./_components/supplier-form";
import { SupplierDetail } from "./_components/supplier-detail";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { Supplier } from "@/types/database.types";

export default function SettingsSuppliersPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [detailSupplierId, setDetailSupplierId] = useState<string | null>(null);

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Captura resultado do fluxo OAuth e exibe feedback
  useEffect(() => {
    const blingConnected = searchParams.get("bling_connected");
    const blingError = searchParams.get("bling_error");
    const supplierId = searchParams.get("supplier_id");

    if (blingConnected === "1") {
      toast.success("Bling conectado com sucesso! O token foi salvo automaticamente.");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      if (supplierId) setDetailSupplierId(supplierId);
      router.replace("/settings/suppliers");
    } else if (blingError) {
      const messages: Record<string, string> = {
        fornecedor_nao_encontrado: "Fornecedor não encontrado.",
        credenciais_ausentes: "Client ID ou Client Secret não configurados.",
        falha_troca_token: "Falha ao trocar o código pelo token. Verifique as credenciais.",
        erro_interno: "Erro interno no servidor.",
        access_denied: "Autorização negada pelo usuário.",
      };
      toast.error(messages[blingError] ?? `Erro ao conectar com Bling: ${blingError}`);
      router.replace("/settings/suppliers");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: getSuppliers,
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      contact_name?: string;
      contact_email?: string;
      contact_phone?: string;
      bling_client_id?: string;
      bling_client_secret?: string;
    }) => {
      const { createSupplier } = await import("@/services/suppliers.service");
      return createSupplier(data);
    },
    onSuccess: () => {
      toast.success("Fornecedor criado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setFormOpen(false);
    },
    onError: () => toast.error("Erro ao criar fornecedor."),
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      deactivateSupplier(id, reason),
    onSuccess: () => {
      toast.success("Fornecedor desativado.");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: () => toast.error("Erro ao desativar fornecedor."),
  });

  function getSupplierStatus(supplier: { is_active?: boolean; agreements?: Array<{ status: string; token_expires_at?: string }> }) {
    const signedAgreement = supplier.agreements?.find(
      (a) => a.status === "signed"
    );
    const pendingAgreement = supplier.agreements?.find(
      (a) =>
        a.status === "pending" &&
        a.token_expires_at &&
        new Date(a.token_expires_at) > new Date()
    );

    if (supplier.is_active && signedAgreement) return "active";
    if (pendingAgreement) return "pending";
    return "inactive";
  }

  function getLastSyncDate(supplier: { logs?: Array<{ status: string; sent_at: string }> }) {
    const logs = supplier.logs ?? [];
    const lastSuccess = logs.find((l) => l.status === "success");
    return lastSuccess?.sent_at;
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Fornecedores"
        description="Gestão de fornecedores com integração Bling"
      >
        <Button
          onClick={() => {
            setEditingSupplier(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Fornecedor
        </Button>
      </PageHeader>

      <div className="rounded-lg border border-border">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <Truck className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Nenhum fornecedor cadastrado
            </p>
            <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
              Adicionar fornecedor
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Termo</TableHead>
                <TableHead>Última Sync</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => {
                const status = getSupplierStatus(supplier);
                const lastSync = getLastSyncDate(supplier);
                const signedAgreement = supplier.agreements?.find(
                  (a: { status: string }) => a.status === "signed"
                );
                const pendingAgreement = supplier.agreements?.find(
                  (a: { status: string; token_expires_at: string }) =>
                    a.status === "pending" &&
                    new Date(a.token_expires_at) > new Date()
                );

                return (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {supplier.contact_name ?? supplier.contact_email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : status === "pending"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-destructive/10 text-destructive"
                        }
                      >
                        {status === "active"
                          ? "Ativo"
                          : status === "pending"
                            ? "Pendente termo"
                            : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AgreementStatus
                        status={
                          signedAgreement
                            ? "signed"
                            : pendingAgreement
                              ? "pending"
                              : "revoked"
                        }
                        signedAt={signedAgreement?.signed_at}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {lastSync ? formatDate(lastSync) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/settings/suppliers/${supplier.id}/inventory`}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            title="Inventário do fornecedor"
                          >
                            <Boxes className="h-3.5 w-3.5" />
                            Inventário
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setDetailSupplierId(supplier.id)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/settings/suppliers/${supplier.id}/inventory`}>
                              <Boxes className="mr-2 h-4 w-4" />
                              Inventário
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingSupplier(supplier);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          {supplier.is_active && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() =>
                                deactivateMutation.mutate({
                                  id: supplier.id,
                                  reason: "Desativado manualmente",
                                })
                              }
                            >
                              Desativar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <SupplierForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingSupplier(null);
        }}
        supplier={editingSupplier}
        onSubmit={async (data) => {
          if (editingSupplier) {
            const { updateSupplier } = await import(
              "@/services/suppliers.service"
            );
            await updateSupplier(editingSupplier.id, data);
            toast.success("Fornecedor atualizado.");
          } else {
            await createMutation.mutateAsync(data);
          }
          queryClient.invalidateQueries({ queryKey: ["suppliers"] });
        }}
      />

      <SupplierDetail
        supplierId={detailSupplierId}
        onClose={() => setDetailSupplierId(null)}
        appUrl={appUrl}
      />
    </div>
  );
}
