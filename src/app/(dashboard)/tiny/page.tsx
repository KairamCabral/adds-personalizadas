"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getSyncLogs,
  syncClients,
  syncProducts,
  syncOrders,
  getTinyConnectionStatus,
  disconnectTiny,
  type TinySyncLog,
} from "@/services/tiny.service";
import { getClientsCount } from "@/services/clients.service";
import { formatDateTime } from "@/lib/utils";
import {
  Users,
  Package,
  ShoppingCart,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Link2,
  Unlink,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export default function TinyPage() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState<"clients" | "products" | "orders" | null>(null);

  // ── Status da conexão ──────────────────────────────────────
  const { data: connected, isLoading: loadingStatus } = useQuery({
    queryKey: ["tiny-connection-status"],
    queryFn: getTinyConnectionStatus,
    refetchOnWindowFocus: true,
  });

  const tinyConnected = !!connected;

  // ── Logs de sincronização ──────────────────────────────────
  const { data: syncData, isLoading: loadingLogs } = useQuery({
    queryKey: ["tiny-sync-logs"],
    queryFn: () => getSyncLogs(undefined, undefined, 1, 20),
  });

  // ── Contagem de clientes no CRM (para comparação com Tiny) ──
  const { data: clientsCount } = useQuery({
    queryKey: ["clients-count"],
    queryFn: getClientsCount,
  });

  const logs = syncData?.logs ?? [];
  const totalLogs = syncData?.total ?? 0;

  // ── Desconectar ────────────────────────────────────────────
  const disconnectMutation = useMutation({
    mutationFn: disconnectTiny,
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Tiny ERP desconectado com sucesso.");
        queryClient.invalidateQueries({ queryKey: ["tiny-connection-status"] });
      } else {
        toast.error(result.error ?? "Erro ao desconectar.");
      }
    },
    onError: () => toast.error("Erro ao desconectar o Tiny ERP."),
  });

  // ── Sincronizações ─────────────────────────────────────────
  const handleSyncClients = async () => {
    setSyncing("clients");
    try {
      const result = await syncClients();
      if (result.success) {
        toast.success(result.message ?? `${result.synced ?? 0} clientes sincronizados.`);
        queryClient.invalidateQueries({ queryKey: ["tiny-sync-logs"] });
        queryClient.invalidateQueries({ queryKey: ["clients-count"] });
      } else {
        toast.error(result.message ?? "Erro ao sincronizar clientes.");
      }
    } catch {
      toast.error("Erro ao sincronizar clientes.");
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncProducts = async () => {
    setSyncing("products");
    try {
      const result = await syncProducts();
      if (result.success) {
        toast.success(result.message ?? `${result.synced ?? 0} produtos sincronizados.`);
        queryClient.invalidateQueries({ queryKey: ["tiny-sync-logs"] });
      } else {
        toast.error(result.message ?? "Erro ao sincronizar produtos.");
      }
    } catch {
      toast.error("Erro ao sincronizar produtos.");
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncOrders = async () => {
    setSyncing("orders");
    try {
      const result = await syncOrders();
      if (result.success) {
        toast.success(result.message ?? `${result.synced ?? 0} pedidos sincronizados.`);
        queryClient.invalidateQueries({ queryKey: ["tiny-sync-logs"] });
      } else {
        toast.error(result.message ?? "Erro ao sincronizar pedidos.");
      }
    } catch {
      toast.error("Erro ao sincronizar pedidos.");
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Integração Tiny ERP"
        description="Sincronize clientes e produtos com o Tiny ERP via OAuth2"
      />

      {/* ── Status da conexão ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Status da conexão</CardTitle>
            <CardDescription>
              Conecte via OAuth2 para sincronizar dados do Tiny ERP
            </CardDescription>
          </div>
          {loadingStatus ? (
            <Skeleton className="h-6 w-28 rounded-full" />
          ) : (
            <Badge
              variant={tinyConnected ? "default" : "secondary"}
              className={
                tinyConnected
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : ""
              }
            >
              {tinyConnected ? (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Conectado
                </>
              ) : (
                <>
                  <XCircle className="mr-1 h-3 w-3" />
                  Não conectado
                </>
              )}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {!loadingStatus && !tinyConnected && (
            <Button asChild>
              <a href="/api/tiny/auth">
                <Link2 className="mr-2 h-4 w-4" />
                Conectar com Tiny ERP
                <ExternalLink className="ml-2 h-3 w-3 opacity-60" />
              </a>
            </Button>
          )}

          {!loadingStatus && tinyConnected && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Unlink className="mr-2 h-4 w-4" />
                  Desconectar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desconectar Tiny ERP?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os tokens de acesso serão removidos. Você precisará
                    autorizar novamente para retomar as sincronizações.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => disconnectMutation.mutate()}
                  >
                    Desconectar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {loadingStatus && (
            <Skeleton className="h-9 w-44 rounded-md" />
          )}
        </CardContent>
      </Card>

      {/* ── Resumo de contagem ── */}
      {clientsCount != null && (
        <Card>
          <CardHeader>
            <CardTitle>Contagem de dados</CardTitle>
            <CardDescription>
              Contatos no CRM vs Tiny ERP (Tiny tem ~11.600 contatos)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="font-medium">{clientsCount.toLocaleString("pt-BR")}</span>{" "}
              clientes no CRM
              {clientsCount < 11600 && (
                <span className="text-muted-foreground">
                  {" "}— sincronize clientes para trazer mais do Tiny
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Sincronização ── */}
      <Card>
        <CardHeader>
          <CardTitle>Sincronização manual</CardTitle>
          <CardDescription>
            Importe clientes, produtos e pedidos do Tiny ERP para o ADDS CRM
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button
            onClick={handleSyncClients}
            disabled={!tinyConnected || !!syncing}
            variant={tinyConnected ? "default" : "secondary"}
          >
            {syncing === "clients" ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando clientes...
              </>
            ) : (
              <>
                <Users className="mr-2 h-4 w-4" />
                Sincronizar clientes
              </>
            )}
          </Button>

          <Button
            onClick={handleSyncProducts}
            disabled={!tinyConnected || !!syncing}
            variant={tinyConnected ? "default" : "secondary"}
          >
            {syncing === "products" ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando produtos...
              </>
            ) : (
              <>
                <Package className="mr-2 h-4 w-4" />
                Sincronizar produtos
              </>
            )}
          </Button>

          <Button
            onClick={handleSyncOrders}
            disabled={!tinyConnected || !!syncing}
            variant={tinyConnected ? "default" : "secondary"}
          >
            {syncing === "orders" ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando pedidos...
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Sincronizar pedidos
              </>
            )}
          </Button>

          {!tinyConnected && !loadingStatus && (
            <p className="w-full text-sm text-muted-foreground">
              Conecte o Tiny ERP acima para habilitar a sincronização.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Logs ── */}
      <Card>
        <CardHeader>
          <CardTitle>Registro de sincronização</CardTitle>
          <CardDescription>
            Histórico das últimas sincronizações realizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <RefreshCw className="mx-auto mb-3 h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhuma sincronização realizada ainda.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Direção</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: TinySyncLog) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                      <TableCell className="capitalize">
                        {log.entity_type}
                      </TableCell>
                      <TableCell>{log.direction}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.status === "success"
                              ? "default"
                              : "destructive"
                          }
                          className={
                            log.status === "success"
                              ? "bg-emerald-100 text-emerald-700"
                              : ""
                          }
                        >
                          {log.status === "success" ? "Sucesso" : "Erro"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {log.error_message ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-4 text-sm text-muted-foreground">
                Exibindo registros mais recentes. Total: {totalLogs} registro
                {totalLogs !== 1 ? "s" : ""} de <strong>operações de sync</strong> (não é a contagem de clientes).
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
