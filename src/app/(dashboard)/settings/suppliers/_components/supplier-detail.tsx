// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
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
  Database,
  Search,
  Users,
  Package,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDate, formatDateTime } from "@/lib/utils";
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
        <SheetContent className="w-full overflow-y-auto sm:max-w-4xl">
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
                <TabsList className="grid w-full grid-cols-4">
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
                  <TabsTrigger value="bling" className="gap-1.5">
                    <Database className="h-4 w-4" />
                    Dados Bling
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

                <TabsContent value="bling" className="mt-4">
                  <BlingDataTab
                    supplierId={supplierId}
                    hasBlingConnection={!!(supplier.bling_access_token || supplier.bling_api_token)}
                  />
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

function BlingDataTab({
  supplierId,
  hasBlingConnection,
}: {
  supplierId: string;
  hasBlingConnection: boolean;
}) {
  const [data, setData] = useState<{
    vendedores: { id?: number; codigo?: number | string; nome?: string; email?: string }[];
    produtos: { id?: number; codigo?: string; nome?: string }[];
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [searchVendedores, setSearchVendedores] = useState("");
  const [searchProdutos, setSearchProdutos] = useState("");

  const [tick, setTick] = useState(0);
  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  const isCooldown = cooldownSeconds > 0;

  const filterTerm = (term: string) => term.trim().toLowerCase();
  const filteredVendedores =
    data?.vendedores.filter((v) => {
      const q = filterTerm(searchVendedores);
      if (!q) return true;
      const nome = (v.nome ?? "").toLowerCase();
      const email = (v.email ?? "").toLowerCase();
      const codigo = String(v.codigo ?? "").toLowerCase();
      const id = String(v.id ?? "").toLowerCase();
      return nome.includes(q) || email.includes(q) || codigo.includes(q) || id.includes(q);
    }) ?? [];
  const filteredProdutos =
    data?.produtos.filter((p) => {
      const q = filterTerm(searchProdutos);
      if (!q) return true;
      const nome = (p.nome ?? "").toLowerCase();
      const codigo = (p.codigo ?? "").toLowerCase();
      const id = String(p.id ?? "").toLowerCase();
      return nome.includes(q) || codigo.includes(q) || id.includes(q);
    }) ?? [];

  useEffect(() => {
    if (!isCooldown) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [isCooldown, cooldownUntil]);

  async function handleLoad() {
    if (!hasBlingConnection || loading || isCooldown) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bling/data?supplier_id=${supplierId}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao buscar dados.");
        return;
      }
      setData({
        vendedores: json.vendedores ?? [],
        produtos: json.produtos ?? [],
        error: json.error,
      });
      setCooldownUntil(Date.now() + 30000);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  if (!hasBlingConnection) {
    return (
      <p className="text-sm text-muted-foreground">
        Conecte o Bling em Editar fornecedor para visualizar vendedores e produtos.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          size="sm"
          onClick={handleLoad}
          disabled={loading || isCooldown}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando vendedores e produtos...
            </>
          ) : isCooldown ? (
            `Aguarde ${cooldownSeconds}s`
          ) : (
            "Carregar dados"
          )}
        </Button>
        {loading && (
          <p className="text-muted-foreground text-xs">
            Catálogos grandes podem levar alguns segundos.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {data?.error && (
        <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {data.error}
        </p>
      )}

      {data && (
        <Tabs defaultValue="vendedores" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-2">
            <TabsTrigger value="vendedores" className="gap-2">
              <Users className="h-4 w-4" />
              Vendedores ({data.vendedores.length})
            </TabsTrigger>
            <TabsTrigger value="produtos" className="gap-2">
              <Package className="h-4 w-4" />
              Produtos ({data.produtos.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vendedores" className="mt-0">
            <div className="flex flex-col rounded-lg border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
                {data.vendedores.length > 0 && (
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por ID ou nome..."
                      value={searchVendedores}
                      onChange={(e) => setSearchVendedores(e.target.value)}
                      className="h-9 pl-8"
                    />
                  </div>
                )}
                <span className="text-muted-foreground text-sm">
                  {searchVendedores
                    ? `${filteredVendedores.length} de ${data.vendedores.length}`
                    : `${data.vendedores.length} vendedores`}
                </span>
              </div>
              {data.vendedores.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">Nenhum vendedor encontrado.</p>
              ) : (
                <ScrollArea className="h-[min(400px,60vh)]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-28 font-semibold">ID</TableHead>
                        <TableHead className="font-semibold">Nome</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVendedores.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="py-12 text-center text-muted-foreground">
                            Nenhum resultado para &quot;{searchVendedores}&quot;
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredVendedores.map((v, i) => (
                          <TableRow key={v.id ?? i}>
                            <TableCell className="font-mono text-sm">{v.id ?? "—"}</TableCell>
                            <TableCell>{v.nome ?? "—"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          <TabsContent value="produtos" className="mt-0">
            <div className="flex flex-col rounded-lg border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
                {data.produtos.length > 0 && (
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por código ou nome..."
                      value={searchProdutos}
                      onChange={(e) => setSearchProdutos(e.target.value)}
                      className="h-9 pl-8"
                    />
                  </div>
                )}
                <span className="text-muted-foreground text-sm">
                  {searchProdutos
                    ? `${filteredProdutos.length} de ${data.produtos.length}`
                    : `${data.produtos.length} produtos`}
                </span>
              </div>
              {data.produtos.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">Nenhum produto encontrado.</p>
              ) : (
                <ScrollArea className="h-[min(400px,60vh)]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-28 font-semibold">ID</TableHead>
                        <TableHead className="w-32 font-semibold">Código</TableHead>
                        <TableHead className="font-semibold">Nome</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProdutos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-12 text-center text-muted-foreground">
                            Nenhum resultado para &quot;{searchProdutos}&quot;
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProdutos.map((p, i) => (
                          <TableRow key={p.id ?? i}>
                            <TableCell className="font-mono text-sm">{p.id ?? "—"}</TableCell>
                            <TableCell className="font-mono text-sm">{p.codigo ?? "—"}</TableCell>
                            <TableCell className="min-w-0 max-w-[280px] truncate" title={p.nome}>
                              {p.nome ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
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
                {log.clients?.name ?? log.client?.name ?? "—"} • {formatDateTime(log.sent_at)}
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
