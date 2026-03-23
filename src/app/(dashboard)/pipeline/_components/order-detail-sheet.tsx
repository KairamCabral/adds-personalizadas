// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { PriorityIndicator } from "@/components/shared/priority-indicator";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { getOrderById, deleteOrder, moveOrder, archiveOrder, unarchiveOrder } from "@/services/orders.service";
import { useUIStore } from "@/stores/ui.store";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { ORDER_STATUSES, type OrderStatus, type LabelType } from "@/lib/constants";
import {
  Calendar,
  Package,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Image,
  Send,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { getSuppliers } from "@/services/suppliers.service";
import { OrderLabels } from "./order-labels";
import { OrderAttachments } from "./order-attachments";
import { OrderArtwork } from "./order-artwork";
import { OrderActivityPanel } from "./order-activity-panel";
import { OrderEditSheet } from "./order-edit-sheet";

const APROVADO_AND_AFTER = [
  "CONFIRMACAO",
  "APROVADO",
  "PRODUCAO",
  "EXPEDICAO",
  "FINALIZADO",
  "ENTREGUE",
  "FATURADO",
  "ARQUIVADO",
];

export function OrderDetailSheet() {
  const { selectedOrderId, setSelectedOrderId } = useUIStore();
  const { can, canAny } = usePermissions();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [sendingToSupplier, setSendingToSupplier] = useState<string | null>(
    null
  );
  const [showDetails, setShowDetails] = useState(true);
  const [blingDuplicateData, setBlingDuplicateData] = useState<{
    recentOrders: {
      order_id: string;
      order_number: number | null;
      order_title: string;
      bling_order_id: number | null;
      days_ago: number;
    }[];
    supplierId: string;
  } | null>(null);

  const open = !!selectedOrderId;

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: getSuppliers,
  });
  const activeSuppliers = suppliers.filter(
    (s: { is_active: boolean }) => s.is_active
  );

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", selectedOrderId],
    queryFn: () => getOrderById(selectedOrderId!),
    enabled: !!selectedOrderId,
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && selectedOrderId && (isError || !order)) {
      toast.error("Pedido não encontrado. Pode ter sido removido ou o ID está desatualizado.");
      setSelectedOrderId(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
    // Evita loop: não incluir queryClient/setSelectedOrderId (estáveis) para reduzir re-execuções
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isError, order, selectedOrderId]);

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrder(selectedOrderId!),
    onSuccess: () => {
      toast.success("Pedido excluído com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedOrderId(null);
    },
    onError: () => {
      toast.error("Erro ao excluir pedido.");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveOrder(selectedOrderId!),
    onSuccess: () => {
      toast.success("Pedido arquivado.");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["archived-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", selectedOrderId] });
      setSelectedOrderId(null);
    },
    onError: () => toast.error("Erro ao arquivar pedido."),
  });

  const unarchiveMutation = useMutation({
    mutationFn: () => unarchiveOrder(selectedOrderId!),
    onSuccess: () => {
      toast.success("Pedido desarquivado.");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["archived-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", selectedOrderId] });
      setSelectedOrderId(null);
    },
    onError: () => toast.error("Erro ao desarquivar pedido."),
  });

  const moveMutation = useMutation({
    mutationFn: ({ orderId, newStatus }: { orderId: string; newStatus: OrderStatus }) =>
      moveOrder(orderId, newStatus, 0),
    onSuccess: async (_data, variables) => {
      toast.success("Etapa alterada.");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", selectedOrderId] });
      // Envio automático ao Bling quando status muda para APROVADO (coluna "Aprovado")
      if (variables.newStatus === "APROVADO") {
        try {
          const res = await fetch("/api/bling/sync-on-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: variables.orderId,
              newStatus: variables.newStatus,
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (json.results?.some((r: { success: boolean }) => r.success)) {
            toast.success("Pedido enviado ao fornecedor automaticamente.");
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["order", selectedOrderId] });
          }
        } catch {
          // Silencioso: o usuário pode reenviar manualmente pelo botão
        }
      }
    },
    onError: () => {
      toast.error("Erro ao alterar etapa.");
    },
  });

  function handleClose() {
    setSelectedOrderId(null);
  }

  function handleSyncResponse(supplierId: string, json: Record<string, unknown>, res: Response) {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["order", order!.id] });
    if (json.requiresConfirmation) {
      setBlingDuplicateData({
        recentOrders:
          (json.recentOrders as {
            order_id: string;
            order_number: number | null;
            order_title: string;
            bling_order_id: number | null;
            days_ago: number;
          }[]) ?? [],
        supplierId,
      });
      return;
    }
    if (json.success) {
      toast.success("Enviado ao fornecedor!", {
        description: json.blingOrderNumber
          ? `Pedido Bling #${json.blingOrderNumber} criado`
          : "Contato e pedido enviados",
      });
    } else if (json.contactSent && !json.orderSent) {
      toast.warning("Contato enviado, mas pedido falhou", {
        description: (json.error as string) ?? "Verifique o mapeamento de SKUs dos produtos",
      });
    } else {
      toast.error("Erro ao enviar", {
        description: (json.error as string) ?? `Tente novamente${res.status ? ` (${res.status})` : ""}`,
      });
    }
  }

  async function handleSyncToSupplier(supplierId: string) {
    if (!order) return;
    setSendingToSupplier(supplierId);
    try {
      const res = await fetch("/api/bling/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          orderId: order.id,
        }),
      });
      const json = await res.json().catch(() => ({}));
      handleSyncResponse(supplierId, json, res);
    } catch {
      toast.error("Erro ao enviar dados.");
    } finally {
      setSendingToSupplier(null);
    }
  }

  async function handleForceSync() {
    if (!blingDuplicateData || !order) return;
    const supplierId = blingDuplicateData.supplierId;
    setBlingDuplicateData(null);
    setSendingToSupplier(supplierId);
    try {
      const res = await fetch("/api/bling/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          orderId: order.id,
          force: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", order.id] });
      if (json.success) {
        toast.success("Enviado ao fornecedor!", {
          description: json.blingOrderNumber
            ? `Pedido Bling #${json.blingOrderNumber} criado`
            : "Contato e pedido enviados",
        });
      } else if (json.contactSent && !json.orderSent) {
        toast.warning("Contato enviado, mas pedido falhou", {
          description: json.error ?? "Verifique o mapeamento de SKUs dos produtos",
        });
      } else {
        toast.error("Erro ao enviar", {
          description: json.error ?? "Tente novamente",
        });
      }
    } catch {
      toast.error("Erro ao enviar dados.");
    } finally {
      setSendingToSupplier(null);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)]"
        >
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <LoadingSpinner text="Carregando pedido..." />
            </div>
          ) : order ? (
            <div className="flex h-full min-h-0">
              {/* Coluna esquerda - detalhes */}
              <div
                className={`flex min-h-0 flex-col overflow-y-auto border-r border-border transition-[flex] duration-200 ${
                  showDetails ? "flex-1" : "hidden"
                }`}
              >
                <div className="flex-1 space-y-2 p-6 pr-4">
              <div className="space-y-2">
                {/* Identificação + Ações */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono text-muted-foreground">
                        #{order.order_number}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <StatusBadge status={order.status} size="md" />
                      {can("orders.change_status") && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <Select
                            value={order.status}
                            onValueChange={(value) =>
                              moveMutation.mutate({
                                orderId: order.id,
                                newStatus: value as OrderStatus,
                              })
                            }
                            disabled={moveMutation.isPending}
                          >
                            <SelectTrigger className="h-8 w-[130px]">
                              <SelectValue placeholder="Alterar etapa" />
                            </SelectTrigger>
                            <SelectContent className="z-[110]">
                              {ORDER_STATUSES.map((s) => (
                                <SelectItem key={s.key} value={s.key}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      )}
                      <span className="text-muted-foreground">·</span>
                      <PriorityIndicator
                        priority={order.priority}
                        showLabel
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <SheetTitle className="min-w-0 flex-1 text-xl font-semibold leading-tight">
                        {order.title}
                      </SheetTitle>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!order.title?.trim()) return;
                                try {
                                  await navigator.clipboard.writeText(order.title.trim());
                                  toast.success("Nome copiado");
                                } catch {
                                  toast.error("Erro ao copiar");
                                }
                              }}
                              className="-mr-1 shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
                              aria-label="Copiar nome"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="pointer-events-none">Copiar nome</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {order.bling_order_id && (
                      <Badge variant="outline" className="mt-2 text-xs border-green-500/50 text-green-600 dark:text-green-400">
                        Bling #{order.bling_order_id}
                      </Badge>
                    )}
                    {order.description &&
                      order.order_type !== "PERSONALIZADO" && (
                      <SheetDescription className="mt-1 text-sm text-muted-foreground">
                        {order.description}
                      </SheetDescription>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canAny("suppliers.send_data", "suppliers.manage") &&
                      order.client_id &&
                      APROVADO_AND_AFTER.includes(order.status) &&
                      (activeSuppliers.length === 1 ? (
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1.5"
                          disabled={!!sendingToSupplier}
                          onClick={() => {
                            const s = activeSuppliers[0] as { id: string; name: string };
                            handleSyncToSupplier(s.id);
                          }}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {sendingToSupplier ? "Enviando..." : "Enviar ao Fornecedor"}
                        </Button>
                      ) : activeSuppliers.length > 1 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="default"
                              size="sm"
                              className="gap-1.5"
                              disabled={!!sendingToSupplier}
                            >
                              <Send className="h-3.5 w-3.5" />
                              Enviar ao Fornecedor
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-[110]">
                            {activeSuppliers.map(
                              (s: { id: string; name: string }) => (
                                <DropdownMenuItem
                                  key={s.id}
                                  onClick={() => handleSyncToSupplier(s.id)}
                                >
                                  {s.name}
                                </DropdownMenuItem>
                              )
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled
                          title="Ative um fornecedor em Configurações → Fornecedores"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Enviar ao Fornecedor
                        </Button>
                      ))}
                    {can("orders.edit") && (
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setEditOrderId(order.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    )}
                    {(can("orders.archive") || can("orders.delete")) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          aria-label="Mais ações"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-[110]">
                        {can("orders.archive") &&
                          (order.archived_at ? (
                            <DropdownMenuItem
                              onClick={() => unarchiveMutation.mutate()}
                              disabled={unarchiveMutation.isPending}
                            >
                              <ArchiveRestore className="mr-2 h-4 w-4" />
                              Desarquivar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => archiveMutation.mutate()}
                              disabled={archiveMutation.isPending}
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Arquivar
                            </DropdownMenuItem>
                          ))}
                        {can("orders.delete") && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteDialogOpen(true)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Labels */}
                <OrderLabels
                  orderId={order.id}
                  currentLabels={
                    (order.labels ?? []).map((l: { id: string; label: LabelType }) => ({
                      id: l.id,
                      label: l.label,
                    }))
                  }
                  canEdit={can("labels.add_to_order")}
                />

                {/* Enviar ao fornecedor — visível quando pedido aprovado e com cliente */}
                {canAny("suppliers.send_data", "suppliers.manage") &&
                  order.client_id &&
                  APROVADO_AND_AFTER.includes(order.status) &&
                  (activeSuppliers.length === 1 ? (
                    <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <p className="mb-2 text-sm font-medium text-foreground">
                        Enviar ao fornecedor
                      </p>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={!!sendingToSupplier}
                        className="gap-2"
                        onClick={() => {
                          const supplier = activeSuppliers[0] as { id: string; name: string };
                          handleSyncToSupplier(supplier.id);
                        }}
                      >
                        <Send className="h-4 w-4" />
                        {sendingToSupplier ? "Enviando..." : "Enviar ao Fornecedor"}
                      </Button>
                    </div>
                  ) : activeSuppliers.length > 1 ? (
                    <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <p className="mb-2 text-sm font-medium text-foreground">
                        Enviar ao fornecedor
                      </p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="default"
                            size="sm"
                            disabled={!!sendingToSupplier}
                            className="gap-2"
                          >
                            <Send className="h-4 w-4" />
                            {sendingToSupplier
                              ? "Enviando..."
                              : "Enviar ao Fornecedor"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="z-[110]">
                          {activeSuppliers.map(
                            (supplier: { id: string; name: string }) => (
                              <DropdownMenuItem
                                key={supplier.id}
                                onClick={() => handleSyncToSupplier(supplier.id)}
                              >
                                {supplier.name}
                              </DropdownMenuItem>
                            )
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : suppliers.length > 0 ? (
                    <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        Enviar ao fornecedor
                      </p>
                      <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                        Ative um fornecedor e assine o termo em{" "}
                        <span className="font-semibold">Configurações → Fornecedores</span>{" "}
                        para habilitar o envio.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-muted p-3">
                      <p className="text-sm text-muted-foreground">
                        Cadastre um fornecedor em{" "}
                        <span className="font-medium">Configurações → Fornecedores</span>{" "}
                        para enviar os dados do pedido.
                      </p>
                    </div>
                  ))}
              </div>

              {/* Cards: Datas, Produtos */}
              <div className="mt-6 space-y-4">
                {/* Card Datas (compacto) */}
                <Card>
                  <CardHeader className="pb-1.5 pt-3 px-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      Datas
                    </h3>
                  </CardHeader>
                  <CardContent className="pt-0 px-4 pb-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="text-muted-foreground">
                        Criado:{" "}
                        <span className="font-medium text-foreground">
                          {formatDate(order.created_at)} ({formatRelativeTime(order.created_at)})
                        </span>
                      </span>
                      {order.start_date && (
                        <>
                          <span className="text-muted-foreground/50">·</span>
                          <span className="text-muted-foreground">
                            Início:{" "}
                            <span className="font-medium text-foreground">
                              {formatDate(order.start_date)}
                            </span>
                          </span>
                        </>
                      )}
                      {order.due_date && (
                        <>
                          <span className="text-muted-foreground/50">·</span>
                          <span className="text-muted-foreground">
                            Entrega:{" "}
                            <span className="font-medium text-foreground">
                              {formatDate(order.due_date)}
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

              {/* Tabs */}
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="flex h-11 w-full justify-start gap-1 rounded-lg bg-muted/80 p-1">
                  <TabsTrigger
                    value="details"
                    className="gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=inactive]:text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    <Package className="h-4 w-4 shrink-0" />
                    Detalhes
                  </TabsTrigger>
                  <TabsTrigger
                    value="artwork"
                    className="group gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=inactive]:text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                  >
                    <Image className="h-4 w-4 shrink-0" />
                    Arte
                    {order.artworks && (order.artworks as unknown[]).length > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 text-xs font-bold text-inherit group-data-[state=active]:bg-primary-foreground/25">
                        {(order.artworks as unknown[]).length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-4 space-y-4">
                  {order.items && (order.items as unknown[]).length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <h4 className="text-sm font-semibold text-foreground">
                            Produtos
                          </h4>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="rounded-lg border border-border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                  <TableHead className="font-semibold">
                                    Produto
                                  </TableHead>
                                  <TableHead className="font-semibold">
                                    Cor
                                  </TableHead>
                                  <TableHead className="font-semibold text-right w-24">
                                    Qtd
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(
                                  order.items as {
                                    id: string;
                                    product_name: string;
                                    quantity: number;
                                    personalization?: {
                                      colors?: string[];
                                      custom_color?: string | null;
                                    };
                                  }[]
                                ).map((item, idx) => {
                                  const p = item.personalization;
                                  const colors = p?.colors ?? [];
                                  const customColor = p?.custom_color;
                                  const colorLabels = colors.map((k) =>
                                    k === "custom"
                                      ? customColor || "Personalizada"
                                      : (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ")
                                  );
                                  const displayColors =
                                    colorLabels.length > 0
                                      ? colorLabels.join(", ")
                                      : "—";

                                  return (
                                    <TableRow
                                      key={item.id}
                                      className={idx % 2 === 1 ? "bg-muted/30" : ""}
                                    >
                                      <TableCell className="font-medium">
                                        {item.product_name}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {displayColors}
                                      </TableCell>
                                      <TableCell className="text-right font-semibold">
                                        {item.quantity}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                            <div className="border-t border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
                              {(
                                order.items as {
                                  id: string;
                                  quantity: number;
                                }[]
                              ).length}{" "}
                              itens ·{" "}
                              {(
                                order.items as {
                                  id: string;
                                  quantity: number;
                                }[]
                              ).reduce((acc, i) => acc + i.quantity, 0)}{" "}
                              unidades
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                  {/* Personalização - destaque abaixo dos produtos */}
                  {(order.order_type === "PERSONALIZADO" ||
                    (order.description && order.description.trim())) && (
                    <Card className="border-primary/40 bg-primary/5">
                      <CardHeader className="pb-2">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Palette className="h-4 w-4 text-primary" />
                          Personalização
                        </h4>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {order.description?.trim() || (
                            <span className="text-muted-foreground">
                              Nenhuma informação de personalização registrada.
                            </span>
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Anexos - abaixo da personalização */}
                  <OrderAttachments orderId={order.id} />
                </TabsContent>

                <TabsContent value="artwork" className="mt-4">
                  <OrderArtwork orderId={order.id} />
                </TabsContent>
              </Tabs>
                </div>
              </div>
              </div>

              {/* Coluna direita - comentários e atividade */}
              <div
                className={`flex min-h-0 flex-col overflow-hidden ${
                  showDetails ? "w-[420px] shrink-0" : "flex-1"
                }`}
              >
                <OrderActivityPanel
                  orderId={order.id}
                  onToggleDetails={() => setShowDetails((v) => !v)}
                  showDetails={showDetails}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Pedido não encontrado.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir pedido"
        description="Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />

      <AlertDialog
        open={!!blingDuplicateData}
        onOpenChange={(open) => !open && setBlingDuplicateData(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-500">
              Pedido já enviado para este cliente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Este cliente já tem pedido(s) enviado(s) ao Bling nos últimos 30 dias:</p>
                <div className="space-y-2">
                  {blingDuplicateData?.recentOrders.map((o) => (
                    <div
                      key={o.order_id}
                      className="flex items-center justify-between rounded bg-muted p-2 text-sm"
                    >
                      <span className="font-medium">
                        #{o.order_number} — {o.order_title}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {o.days_ago === 0
                          ? "hoje"
                          : `há ${o.days_ago} dia${o.days_ago > 1 ? "s" : ""}`}
                        {o.bling_order_id && ` · Bling #${o.bling_order_id}`}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-sm">Deseja enviar mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceSync}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Enviar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrderEditSheet
        orderId={editOrderId}
        open={!!editOrderId}
        onOpenChange={(open) => !open && setEditOrderId(null)}
      />
    </>
  );
}
