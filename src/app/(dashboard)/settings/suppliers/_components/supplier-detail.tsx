// @ts-nocheck
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings,
  FileSignature,
  History,
  Link2,
  Ban,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getSupplierById, updateSupplier } from "@/services/suppliers.service";
import {
  generateAgreementToken,
  revokeAgreement,
} from "@/services/agreements.service";
import { getDataLogs } from "@/services/bling.service";
import { AgreementStatus } from "./agreement-status";
import { SharedFieldsConfig } from "./shared-fields-config";
import { SupplierForm } from "./supplier-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/utils";
import { normalizeSharedFields } from "@/services/bling.service";
import type { Supplier, SupplierAgreement, SupplierDataLog } from "@/types/database.types";

interface SupplierDetailProps {
  supplierId: string | null;
  onClose: () => void;
  appUrl: string;
}

export function SupplierDetail({
  supplierId,
  onClose,
  appUrl,
}: SupplierDetailProps) {
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const { data: supplier, isLoading } = useQuery({
    queryKey: ["supplier", supplierId],
    queryFn: () => getSupplierById(supplierId!),
    enabled: !!supplierId,
  });

  const agreements = (supplier?.agreements ?? []) as SupplierAgreement[];
  const activeAgreement = agreements.find((a) => a.status === "signed");
  const pendingAgreement = agreements.find(
    (a) => a.status === "pending" && new Date(a.token_expires_at) > new Date()
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Supplier> }) =>
      updateSupplier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier", supplierId] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      revokeAgreement(id, reason),
    onSuccess: () => {
      toast.success("Termo revogado.");
      queryClient.invalidateQueries({ queryKey: ["supplier", supplierId] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setRevokeTarget(null);
      setRevokeReason("");
    },
    onError: () => toast.error("Erro ao revogar termo."),
  });

  async function handleGenerateLink() {
    if (!supplierId) return;
    try {
      const agreement = await generateAgreementToken(supplierId, 7);
      const url = `${appUrl}/supplier/agreement/${agreement.token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para a área de transferência.");
      queryClient.invalidateQueries({ queryKey: ["supplier", supplierId] });
    } catch {
      toast.error("Erro ao gerar link.");
    }
  }

  function handleCopyLink() {
    if (!pendingAgreement) return;
    const url = `${appUrl}/supplier/agreement/${pendingAgreement.token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado.");
  }

  if (!supplierId) return null;

  return (
    <>
      <Sheet open={!!supplierId} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : supplier ? (
            <>
              <SheetHeader>
                <SheetTitle>{supplier.name}</SheetTitle>
              </SheetHeader>

              <Tabs defaultValue="config" className="mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="config" className="gap-1.5">
                    <Settings className="h-4 w-4" />
                    Config
                  </TabsTrigger>
                  <TabsTrigger value="agreement" className="gap-1.5">
                    <FileSignature className="h-4 w-4" />
                    Termo
                  </TabsTrigger>
                  <TabsTrigger value="logs" className="gap-1.5">
                    <History className="h-4 w-4" />
                    Logs
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="mt-4 space-y-4">
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
                      Editar
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Contato:</span>{" "}
                      {supplier.contact_name ?? "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">E-mail:</span>{" "}
                      {supplier.contact_email ?? "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Telefone:</span>{" "}
                      {supplier.contact_phone ?? "—"}
                    </p>
                    <BlingConnectionStatus supplier={supplier} />
                  </div>
                  <div>
                    <Label className="mb-2 block">Campos compartilhados</Label>
                    <SharedFieldsConfig
                      value={normalizeSharedFields(supplier.shared_fields)}
                      onChange={(v) =>
                        updateMutation.mutate({
                          id: supplierId,
                          data: { shared_fields: v as never },
                        })
                      }
                    />
                  </div>
                </TabsContent>

                <TabsContent value="agreement" className="mt-4 space-y-4">
                  <AgreementStatus
                    status={
                      activeAgreement
                        ? "signed"
                        : pendingAgreement
                          ? "pending"
                          : "revoked"
                    }
                    signedAt={activeAgreement?.signed_at}
                    linkUrl={
                      pendingAgreement
                        ? `${appUrl}/supplier/agreement/${pendingAgreement.token}`
                        : null
                    }
                    onCopyLink={handleCopyLink}
                  />

                  {!activeAgreement && !pendingAgreement && (
                    <Button size="sm" onClick={handleGenerateLink}>
                      <Link2 className="mr-2 h-4 w-4" />
                      Gerar link de assinatura
                    </Button>
                  )}

                  {activeAgreement && (
                    <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
                      <p>
                        <span className="text-muted-foreground">Assinado por:</span>{" "}
                        {activeAgreement.signer_name}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Cargo:</span>{" "}
                        {activeAgreement.signer_role}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Data:</span>{" "}
                        {formatDate(activeAgreement.signed_at!)}
                      </p>
                      {activeAgreement.signer_ip && (
                        <p>
                          <span className="text-muted-foreground">IP:</span>{" "}
                          <code className="text-xs">{activeAgreement.signer_ip}</code>
                        </p>
                      )}
                      {activeAgreement.signer_user_agent && (
                        <p>
                          <span className="text-muted-foreground">Dispositivo:</span>{" "}
                          <span className="text-xs text-muted-foreground break-all">
                            {activeAgreement.signer_user_agent}
                          </span>
                        </p>
                      )}
                      <p>
                        <span className="text-muted-foreground">Hash:</span>{" "}
                        <code className="text-xs">
                          {activeAgreement.agreement_hash?.slice(0, 16)}...
                        </code>
                      </p>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="mt-2"
                        onClick={() => setRevokeTarget(activeAgreement.id)}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Revogar termo
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="logs" className="mt-4">
                  <LogsTab supplierId={supplierId} />
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <SupplierForm
        open={formOpen}
        onOpenChange={setFormOpen}
        supplier={supplier}
        onSubmit={async (data) => {
          await updateSupplier(supplierId, data);
          toast.success("Fornecedor atualizado.");
          queryClient.invalidateQueries({ queryKey: ["supplier", supplierId] });
          queryClient.invalidateQueries({ queryKey: ["suppliers"] });
        }}
      />

      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar termo</AlertDialogTitle>
            <AlertDialogDescription>
              O fornecedor será desativado e não receberá mais dados. Informe o
              motivo:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Motivo da revogação"
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            className="mt-4"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (revokeTarget && revokeReason.trim()) {
                  revokeMutation.mutate({
                    id: revokeTarget,
                    reason: revokeReason,
                  });
                }
              }}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function LogsTab({ supplierId }: { supplierId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["supplier-logs", supplierId, page],
    queryFn: () => getDataLogs(supplierId, page, 10),
  });

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const logs = (data?.data ?? []) as (SupplierDataLog & {
    orders?: { order_number?: number; title?: string };
    clients?: { name?: string };
    client?: { name?: string };
  })[];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum envio registrado ainda.
          </p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <div className="flex justify-between">
                <span className="font-medium">
                  Pedido #{log.orders?.order_number ?? "—"} — {log.orders?.title ?? "—"}
                </span>
                <span
                  className={
                    log.status === "success"
                      ? "text-emerald-600"
                      : "text-destructive"
                  }
                >
                  {log.status === "success" ? "Sucesso" : "Erro"}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {log.clients?.name ?? log.client?.name ?? "—"} • {formatDate(log.sent_at)}
              </p>
              {log.error_message && (
                <p className="mt-1 text-xs text-destructive">
                  {log.error_message}
                </p>
              )}
            </div>
          ))
        )}
      </div>
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}

function BlingConnectionStatus({ supplier }: { supplier: Supplier }) {
  const isConnected = !!(supplier.bling_access_token && supplier.bling_token_expires_at);
  const tokenExpiry = supplier.bling_token_expires_at
    ? new Date(supplier.bling_token_expires_at)
    : null;
  const isExpired = tokenExpiry ? tokenExpiry.getTime() < Date.now() : false;

  if (isConnected && !isExpired) {
    return (
      <p>
        <span className="text-muted-foreground">Bling API:</span>{" "}
        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Conectado
        </span>
        {tokenExpiry && (
          <span className="ml-2 text-xs text-muted-foreground">
            (expira {tokenExpiry.toLocaleDateString("pt-BR")})
          </span>
        )}
      </p>
    );
  }

  if (isConnected && isExpired) {
    return (
      <p>
        <span className="text-muted-foreground">Bling API:</span>{" "}
        <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
          <AlertCircle className="h-3.5 w-3.5" />
          Token expirado
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          — Clique em Editar para reconectar
        </span>
      </p>
    );
  }

  return (
    <p>
      <span className="text-muted-foreground">Bling API:</span>{" "}
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <XCircle className="h-3.5 w-3.5" />
        Não conectado
      </span>
    </p>
  );
}
