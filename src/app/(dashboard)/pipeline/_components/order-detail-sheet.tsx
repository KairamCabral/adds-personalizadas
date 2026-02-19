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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSuppliers } from "@/services/suppliers.service";
import { OrderLabels } from "./order-labels";
import { OrderAttachments } from "./order-attachments";
import { OrderArtwork } from "./order-artwork";
import { OrderActivityPanel } from "./order-activity-panel";

const PRODUCAO_AND_AFTER = [
  "PRODUCAO",
  "EXPEDICAO",
  "FINALIZADO",
  "ENTREGUE",
  "FATURADO",
  "ARQUIVADO",
];

export function OrderDetailSheet() {
  const { selectedOrderId, setSelectedOrderId } = useUIStore();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sendingToSupplier, setSendingToSupplier] = useState<string | null>(
    null
  );
  const [showDetails, setShowDetails] = useState(true);

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
  }, [isLoading, isError, order, selectedOrderId, setSelectedOrderId, queryClient]);

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
    onSuccess: () => {
      toast.success("Etapa alterada.");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", selectedOrderId] });
    },
    onError: () => {
      toast.error("Erro ao alterar etapa.");
    },
  });

  function handleClose() {
    setSelectedOrderId(null);
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
                            <SelectContent>
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
                    <SheetTitle className="mt-2 text-xl font-semibold leading-tight">
                      {order.title}
                    </SheetTitle>
                    {order.description &&
                      order.order_type !== "PERSONALIZADO" && (
                      <SheetDescription className="mt-1 text-sm text-muted-foreground">
                        {order.description}
                      </SheetDescription>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {can("orders.edit") && (
                      <Button variant="default" size="sm" className="gap-1.5">
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
                      <DropdownMenuContent align="end">
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
                  {can("suppliers.send_data") &&
                    order.client_id &&
                    PRODUCAO_AND_AFTER.includes(order.status) &&
                    activeSuppliers.length > 0 && (
                      <div className="rounded-lg border border-border p-3">
                        <p className="mb-2 text-sm font-medium text-muted-foreground">
                          Enviar ao fornecedor
                        </p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!!sendingToSupplier}
                            >
                              <Send className="mr-2 h-4 w-4" />
                              {sendingToSupplier
                                ? "Enviando..."
                                : "Enviar ao Fornecedor"}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {activeSuppliers.map(
                              (supplier: { id: string; name: string }) => (
                                <DropdownMenuItem
                                  key={supplier.id}
                                  onClick={async () => {
                                    setSendingToSupplier(supplier.id);
                                    try {
                                      const res = await fetch(
                                        "/api/bling/sync",
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            supplierId: supplier.id,
                                            orderId: order.id,
                                          }),
                                        }
                                      );
                                      const json = await res.json();
                                      if (json.success) {
                                        toast.success(
                                          `Dados enviados ao fornecedor ${supplier.name}`
                                        );
                                        queryClient.invalidateQueries({
                                          queryKey: ["orders"],
                                        });
                                      } else {
                                        toast.error(
                                          json.error ?? "Erro ao enviar"
                                        );
                                      }
                                    } catch {
                                      toast.error("Erro ao enviar dados.");
                                    } finally {
                                      setSendingToSupplier(null);
                                    }
                                  }}
                                >
                                  {supplier.name}
                                </DropdownMenuItem>
                              )
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
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
    </>
  );
}
