"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Sparkles,
  Truck,
  MapPin,
  User,
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle,
  Printer,
  ExternalLink,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TinyOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

type TinyCompleteResponse = {
  numeroPedido?: number;
  situacao?: number;
  situacaoLabel?: string;
  crmOrderNumber?: number | null;
  data?: string;
  dataPrevista?: string | null;
  dataEnvio?: string | null;
  cliente: {
    nome: string;
    fantasia?: string | null;
    tipoPessoa?: string;
    cpfCnpj?: string;
    telefone?: string | null;
    celular?: string | null;
    email?: string | null;
    endereco?: {
      endereco?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      municipio?: string;
      cep?: string;
      uf?: string;
    } | null;
  };
  enderecoEntrega?: {
    endereco?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    cep?: string;
    uf?: string;
    nomeDestinatario?: string;
  } | null;
  personalizedItems?: Array<{
    produto?: { descricao?: string; sku?: string };
    quantidade: number;
    valorUnitario: number;
  }>;
  otherItems?: Array<{
    produto?: { descricao?: string; sku?: string };
    quantidade: number;
    valorUnitario: number;
  }>;
  totalItems?: number;
  valorTotalProdutos?: number;
  valorTotalPedido?: number;
  valorDesconto?: number;
  valorFrete?: number;
  transportador?: {
    nome: string;
    codigoRastreamento?: string | null;
    urlRastreamento?: string | null;
    formaEnvio?: string | null;
  } | null;
  observacoes?: string | null;
  observacoesInternas?: string | null;
  deposito?: { id?: number; nome?: string } | null;
  vendedor?: { id?: number; nome?: string } | null;
  code?: string;
  hideValues?: boolean;
};

const SITUACAO_COLORS: Record<number, string> = {
  8: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-900/40 dark:text-gray-200 dark:border-gray-700",
  0: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  3: "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
  4: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  1: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  7: "bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800",
  5: "bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
  6: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  2: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  9: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
};

function formatBRL(value: number | null | undefined): string {
  if (value == null || value === 0) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const [ymd] = dateStr.split("T");
    const [year, month, day] = ymd.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

export function TinyOrderSheet({ open, onOpenChange, orderId }: TinyOrderSheetProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["tiny-complete", orderId],
    queryFn: async () => {
      if (!orderId) throw new Error("Sem orderId");
      const res = await fetch(`/api/orders/${orderId}/tiny-complete`);
      const json = (await res.json()) as TinyCompleteResponse & { error?: string };
      if (!res.ok) {
        const msg =
          json.error ??
          (res.status === 401 && json.code === "TINY_RECONNECT"
            ? "Tiny ERP desconectado. Reconecte em Configurações > Integrações."
            : `HTTP ${res.status}`);
        throw new Error(msg);
      }
      return json as TinyCompleteResponse;
    },
    enabled: open && !!orderId,
    staleTime: 60_000,
    retry: 1,
  });

  const syncBlingMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Sem orderId");
      const res = await fetch(`/api/orders/${orderId}/sync-complete-bling`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json;
    },
    onSuccess: (data: {
      success?: boolean;
      message?: string;
      error?: string;
      blingOrderNumber?: number;
    }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      }
      if (data.success) {
        toast.success(data.message ?? "Sincronizado com Bling", {
          description: data.blingOrderNumber
            ? `Pedido Bling #${data.blingOrderNumber}`
            : undefined,
        });
      } else {
        toast.warning("Envio parcial", { description: data.error });
      }
    },
    onError: (err: Error) => {
      toast.error("Erro ao sincronizar", { description: err.message });
    },
  });

  const handlePrint = () => {
    const printContent = document.getElementById("tiny-order-print-area");
    if (!printContent) return;
    const printWindow = window.open("", "_blank", "width=800,height=1000");
    if (!printWindow) return;
    const num = data?.numeroPedido ?? "";
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pedido #${num} - ADDS Brasil</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 24px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          h2 { font-size: 16px; color: #444; margin-top: 20px; margin-bottom: 8px; border-bottom: 2px solid #e5e5e5; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #e5e5e5; font-size: 13px; }
          th { font-weight: 600; color: #666; font-size: 11px; text-transform: uppercase; }
          .text-right { text-align: right; }
          .client-info { background: #f9fafb; padding: 12px; border-radius: 8px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
          .obs { background: #fffbeb; padding: 10px; border-radius: 6px; border-left: 3px solid #f59e0b; font-size: 13px; white-space: pre-wrap; }
          @media print { body { padding: 12px; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const situacaoKey =
    typeof data?.situacao === "number" ? data.situacao : Number(data?.situacao);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto p-0 sm:max-w-2xl"
      >
        {isLoading && (
          <div className="space-y-4 p-4">
            <Skeleton className="h-8 w-[75%]" />
            <Skeleton className="h-4 w-1/2" />
            <Separator />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <AlertTriangle className="mb-4 h-12 w-12 text-destructive/60" />
            <p className="text-sm font-medium text-destructive">
              {(error as Error)?.message ?? "Erro ao carregar pedido"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Verifique se o Tiny ERP está conectado em Configurações
            </p>
          </div>
        )}

        {data && (
          <div id="tiny-order-print-area" className="flex flex-1 flex-col p-6">
            <SheetHeader className="pb-4 text-left">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <SheetTitle className="text-xl font-bold">
                    Pedido Tiny #{data.numeroPedido}
                  </SheetTitle>
                  <SheetDescription className="mt-1">
                    CRM #{data.crmOrderNumber ?? "—"} · {formatDate(data.data)}
                  </SheetDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      SITUACAO_COLORS[
                        Number.isFinite(situacaoKey) ? situacaoKey : 0
                      ] ?? ""
                    }
                  >
                    {data.situacaoLabel}
                  </Badge>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    type="button"
                    onClick={() => syncBlingMutation.mutate()}
                    disabled={syncBlingMutation.isPending}
                  >
                    {syncBlingMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {syncBlingMutation.isPending ? "Enviando..." : "Sincronizar com Bling"}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrint}
                    className="h-8 w-8"
                    type="button"
                    title="Imprimir / PDF"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <Separator className="mb-4" />

            <section className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <User className="h-4 w-4" />
                Cliente
              </h3>
              <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                <p className="font-semibold text-foreground">
                  {data.cliente.nome}
                  {data.cliente.fantasia && data.cliente.fantasia !== data.cliente.nome && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({data.cliente.fantasia})
                    </span>
                  )}
                </p>
                {data.cliente.cpfCnpj && (
                  <p className="text-sm text-muted-foreground">
                    {data.cliente.tipoPessoa === "J" ? "CNPJ" : "CPF"}:{" "}
                    {data.cliente.cpfCnpj}
                  </p>
                )}
                {data.cliente.endereco && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>
                      {[
                        data.cliente.endereco.endereco,
                        data.cliente.endereco.numero && `nº ${data.cliente.endereco.numero}`,
                        data.cliente.endereco.complemento,
                        data.cliente.endereco.bairro,
                        data.cliente.endereco.municipio &&
                          `${data.cliente.endereco.municipio}/${data.cliente.endereco.uf}`,
                        data.cliente.endereco.cep && `CEP ${data.cliente.endereco.cep}`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}
                {(data.cliente.telefone || data.cliente.celular || data.cliente.email) && (
                  <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
                    {data.cliente.telefone && <span>Tel: {data.cliente.telefone}</span>}
                    {data.cliente.celular && <span>Cel: {data.cliente.celular}</span>}
                    {data.cliente.email && <span>Email: {data.cliente.email}</span>}
                  </div>
                )}
              </div>
            </section>

            {data.enderecoEntrega?.endereco && (
              <section className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  Endereço de Entrega
                </h3>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/20">
                  {data.enderecoEntrega.nomeDestinatario && (
                    <p className="mb-1 font-medium">{data.enderecoEntrega.nomeDestinatario}</p>
                  )}
                  <p>
                    {[
                      data.enderecoEntrega.endereco,
                      data.enderecoEntrega.numero && `nº ${data.enderecoEntrega.numero}`,
                      data.enderecoEntrega.complemento,
                      data.enderecoEntrega.bairro,
                      data.enderecoEntrega.municipio &&
                        `${data.enderecoEntrega.municipio}/${data.enderecoEntrega.uf}`,
                      data.enderecoEntrega.cep && `CEP ${data.enderecoEntrega.cep}`,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </section>
            )}

            {(data.personalizedItems?.length ?? 0) > 0 && (
              <section className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
                  <Sparkles className="h-4 w-4" />
                  Itens Personalizados ({data.personalizedItems?.length})
                </h3>
                <div className="overflow-hidden rounded-lg border border-primary/20 bg-primary/5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-primary/10 bg-primary/10">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-primary">
                          Produto
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-primary">SKU</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-primary">Qtd</th>
                        {!data.hideValues && (
                          <th className="px-3 py-2 text-right text-xs font-semibold text-primary">
                            Valor Un.
                          </th>
                        )}
                        {!data.hideValues && (
                          <th className="px-3 py-2 text-right text-xs font-semibold text-primary">Total</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.personalizedItems?.map((item, idx) => (
                        <tr key={idx} className="border-b border-primary/10 last:border-0">
                          <td className="px-3 py-2 font-medium">{item.produto?.descricao ?? "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {item.produto?.sku ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{item.quantidade}</td>
                          {!data.hideValues && (
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatBRL(item.valorUnitario)}
                            </td>
                          )}
                          {!data.hideValues && (
                            <td className="px-3 py-2 text-right tabular-nums font-medium">
                              {formatBRL(item.quantidade * (item.valorUnitario ?? 0))}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {(data.otherItems?.length ?? 0) > 0 && (
              <section className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <Package className="h-4 w-4" />
                  Outros Itens do Pedido ({data.otherItems?.length})
                </h3>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                          Produto
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">SKU</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Qtd</th>
                        {!data.hideValues && (
                          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                            Valor Un.
                          </th>
                        )}
                        {!data.hideValues && (
                          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.otherItems?.map((item, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="px-3 py-2">{item.produto?.descricao ?? "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {item.produto?.sku ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{item.quantidade}</td>
                          {!data.hideValues && (
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatBRL(item.valorUnitario)}
                            </td>
                          )}
                          {!data.hideValues && (
                            <td className="px-3 py-2 text-right tabular-nums font-medium">
                              {formatBRL(item.quantidade * (item.valorUnitario ?? 0))}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {!data.personalizedItems?.length && !data.otherItems?.length && (
              <div className="mb-6 rounded-lg border border-dashed p-8 text-center">
                <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhum item encontrado no pedido Tiny</p>
              </div>
            )}

            {!data.hideValues && (
              <section className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Totais
                </h3>
                <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Produtos ({data.totalItems ?? 0} linhas)
                    </span>
                    <span className="tabular-nums">{formatBRL(data.valorTotalProdutos)}</span>
                  </div>
                  {(data.valorDesconto ?? 0) > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Desconto</span>
                      <span className="tabular-nums">- {formatBRL(data.valorDesconto)}</span>
                    </div>
                  )}
                  {(data.valorFrete ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frete</span>
                      <span className="tabular-nums">{formatBRL(data.valorFrete)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>Total do Pedido</span>
                    <span className="tabular-nums">{formatBRL(data.valorTotalPedido)}</span>
                  </div>
                </div>
              </section>
            )}

            {data.transportador && (
              <section className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <Truck className="h-4 w-4" />
                  Envio
                </h3>
                <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Transportador</span>
                    <span className="font-medium">{data.transportador.nome}</span>
                  </div>
                  {data.transportador.formaEnvio && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Forma de envio</span>
                      <span>{data.transportador.formaEnvio}</span>
                    </div>
                  )}
                  {data.transportador.codigoRastreamento && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Rastreamento</span>
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                          {data.transportador.codigoRastreamento}
                        </code>
                        {data.transportador.urlRastreamento && (
                          <a
                            href={data.transportador.urlRastreamento}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {(data.observacoes || data.observacoesInternas) && (
              <section className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Observações
                </h3>
                {data.observacoes && (
                  <div className="mb-2 whitespace-pre-wrap rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
                    {data.observacoes}
                  </div>
                )}
                {data.observacoesInternas && (
                  <div className="whitespace-pre-wrap rounded-lg border-l-4 border-blue-400 bg-blue-50 p-3 text-sm dark:bg-blue-950/20">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Interna: </span>
                    {data.observacoesInternas}
                  </div>
                )}
              </section>
            )}

            <section className="mb-4 mt-auto">
              <div className="flex flex-wrap gap-2 text-xs">
                {data.deposito && (
                  <Badge variant="outline" className="gap-1">
                    Depósito: {data.deposito.nome}
                  </Badge>
                )}
                {data.vendedor && (
                  <Badge variant="outline" className="gap-1">
                    Vendedor: {data.vendedor.nome}
                  </Badge>
                )}
                {data.dataPrevista && (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    Previsão: {formatDate(data.dataPrevista)}
                  </Badge>
                )}
                {data.dataEnvio && (
                  <Badge variant="outline" className="gap-1 border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-400">
                    Enviado: {formatDate(data.dataEnvio)}
                  </Badge>
                )}
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
