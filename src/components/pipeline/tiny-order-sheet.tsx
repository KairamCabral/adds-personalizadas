"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
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
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  /** Definido pelo GET tiny-complete (mesma regra do servidor que POST unlink-tiny). */
  canUnlinkTiny?: boolean;
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
  const { can } = usePermissions();
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

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

  /** Preferir flag do servidor (evita perfil desatualizado no client em produção). */
  const showUnlinkTiny = Boolean(data?.canUnlinkTiny ?? can("orders.edit"));

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

  const unlinkTinyMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Sem orderId");
      const res = await fetch(`/api/orders/${orderId}/unlink-tiny`, {
        method: "POST",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Erro ao desvincular" }));
        throw new Error(errorData.error || "Erro ao desvincular do Tiny");
      }
      return res.json();
    },
    onSuccess: (data: { message?: string }) => {
      toast.success(data.message || "Pedido desvinculado do Tiny com sucesso.");
      if (orderId) {
        queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        queryClient.invalidateQueries({ queryKey: ["tiny-complete", orderId] });
      }
      setShowUnlinkConfirm(false);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setShowUnlinkConfirm(false);
    },
  });

  const handlePrint = () => {
    if (!data) return;

    const fmtBRL = (v: number | null | undefined): string => {
      if (v == null || v === 0) return "—";
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
    };

    const fmtDate = (d: string | null | undefined): string => {
      if (!d) return "—";
      try {
        const [ymd] = d.split("T");
        const [y, m, day] = ymd.split("-");
        return `${day}/${m}/${y}`;
      } catch {
        return d;
      }
    };

    const showV = !data.hideValues;
    const logoUrl = window.location.origin + "/Logo-cor-PNG.png";
    const today = new Date().toLocaleDateString("pt-BR");

    const itemRow = (item: any, idx: number, show: boolean) => `
    <tr style="background:${idx % 2 === 0 ? "#fff" : "#f8f9fa"};">
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;">${item.produto?.descricao ?? "—"}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:11px;font-family:'Courier New',monospace;color:#6b7280;">${item.produto?.sku ?? "—"}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;font-weight:700;">${item.quantidade ?? 0}</td>
      ${show ? `<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;">${fmtBRL(item.valorUnitario)}</td>` : ""}
      ${show ? `<td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;font-weight:600;">${fmtBRL((item.quantidade ?? 0) * (item.valorUnitario ?? 0))}</td>` : ""}
    </tr>`;

    const itemTable = (items: any[], accent: string, label: string) => {
      if (!items || items.length === 0) return "";
      return `
      <div style="margin-bottom:18px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:${accent};margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid ${accent};">${label} (${items.length})</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:${accent};">
              <th style="padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:left;">Produto</th>
              <th style="padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:left;">SKU</th>
              <th style="padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:center;">Qtd</th>
              ${showV ? '<th style="padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:right;">Valor Un.</th>' : ""}
              ${showV ? '<th style="padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#fff;text-align:right;">Total</th>' : ""}
            </tr>
          </thead>
          <tbody>${items.map((it: any, i: number) => itemRow(it, i, showV)).join("")}</tbody>
        </table>
      </div>`;
    };

    const addr = (e: any) =>
      [
        e?.endereco,
        e?.numero && "nº " + e.numero,
        e?.complemento,
        e?.bairro,
        e?.municipio && e.municipio + "/" + (e.uf ?? ""),
        e?.cep && "CEP " + e.cep,
      ]
        .filter(Boolean)
        .join(", ");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Pedido #${data.numeroPedido} — ADDS Brasil</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { margin:20mm; size:A4; }
  body { font-family:'Segoe UI',system-ui,-apple-system,sans-serif; color:#1f2937; line-height:1.45; background:#fff; padding:0; font-size:12px; }
  
  .header { display:flex; justify-content:space-between; align-items:center; padding-bottom:14px; border-bottom:2px solid #d1d5db; margin-bottom:18px; }
  .header-left { display:flex; align-items:center; gap:14px; }
  .header-logo img { height:44px; width:auto; }
  .header-title h1 { font-size:16px; font-weight:800; color:#1f2937; letter-spacing:-0.3px; }
  .header-title .sub { font-size:11px; color:#6b7280; margin-top:1px; }
  .header-right { text-align:right; }
  .header-right .pedido-num { font-size:20px; font-weight:800; color:#0f766e; }
  .header-right .pedido-date { font-size:10px; color:#9ca3af; margin-top:2px; }
  
  .status-badge { display:inline-block; padding:2px 10px; border-radius:10px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px; }
  
  .two-col { display:flex; gap:14px; margin-bottom:18px; }
  .two-col > div { flex:1; }
  
  .card { background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:10px 14px; }
  .card-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1.2px; color:#6b7280; margin-bottom:6px; }
  .card .name { font-size:14px; font-weight:700; color:#1f2937; margin-bottom:3px; }
  .card .detail { font-size:11px; color:#6b7280; margin-bottom:2px; }
  .card .address { font-size:11px; color:#374151; margin-top:5px; padding-top:5px; border-top:1px solid #e5e7eb; }
  .card .contact { font-size:10px; color:#6b7280; margin-top:4px; }
  
  .ship-card { background:#f0fdf4; border:1px solid #d1fae5; border-radius:6px; padding:10px 14px; }
  .ship-row { display:flex; justify-content:space-between; font-size:11px; padding:2px 0; }
  .ship-label { color:#6b7280; }
  .ship-val { font-weight:600; color:#1f2937; }
  
  .totals { background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:10px 14px; margin-bottom:18px; }
  .tot-row { display:flex; justify-content:space-between; font-size:12px; padding:3px 0; }
  .tot-row.grand { border-top:2px solid #374151; margin-top:6px; padding-top:8px; font-size:15px; font-weight:800; }
  
  .obs { border-radius:6px; padding:8px 12px; font-size:11px; white-space:pre-wrap; margin-bottom:6px; }
  .obs-pub { background:#fefce8; border-left:3px solid #eab308; color:#854d0e; }
  .obs-int { background:#eff6ff; border-left:3px solid #3b82f6; color:#1e40af; }
  
  .footer { margin-top:20px; padding-top:10px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center; }
  .footer-left { display:flex; gap:6px; flex-wrap:wrap; }
  .footer-badge { display:inline-block; background:#f3f4f6; padding:2px 8px; border-radius:3px; font-size:9px; color:#6b7280; }
  .footer-right { font-size:9px; color:#9ca3af; }
  
  .section-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.2px; color:#374151; margin-bottom:6px; padding-bottom:4px; border-bottom:2px solid #e5e7eb; }
  
  .delivery-card { background:#fefce8; border:1px solid #fde68a; border-radius:6px; padding:10px 14px; margin-bottom:18px; font-size:11px; }
  
  @media print { body { padding:0; } }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-left">
    <div class="header-logo"><img src="${logoUrl}" alt="ADDS Brasil" onerror="this.style.display='none'"></div>
    <div class="header-title">
      <h1>ADDS Brasil</h1>
      <div class="sub">Ficha Técnica do Pedido</div>
    </div>
  </div>
  <div class="header-right">
    <div class="pedido-num">#${data.numeroPedido ?? "—"}</div>
    <div class="pedido-date">CRM #${data.crmOrderNumber ?? "—"} · ${fmtDate(data.data)}</div>
    <span class="status-badge" style="background:${
      data.situacao === 3
        ? "#dcfce7;color:#166534"
        : data.situacao === 0
          ? "#dbeafe;color:#1e40af"
          : [5, 7].includes(data.situacao ?? -1)
            ? "#ccfbf1;color:#0f766e"
            : data.situacao === 6
              ? "#d1fae5;color:#065f46"
              : data.situacao === 2
                ? "#fee2e2;color:#991b1b"
                : data.situacao === 1
                  ? "#f3e8ff;color:#6b21a8"
                  : "#f3f4f6;color:#4b5563"
    }">${data.situacaoLabel ?? "—"}</span>
  </div>
</div>

<!-- CLIENTE + ENVIO -->
<div class="two-col">
  <div>
    <div class="card">
      <div class="card-title">Cliente</div>
      <div class="name">${data.cliente?.nome ?? "—"}${data.cliente?.fantasia && data.cliente.fantasia !== data.cliente.nome ? " (" + data.cliente.fantasia + ")" : ""}</div>
      ${data.cliente?.cpfCnpj ? `<div class="detail">${data.cliente.tipoPessoa === "J" ? "CNPJ" : "CPF"}: ${data.cliente.cpfCnpj}</div>` : ""}
      ${data.cliente?.endereco ? `<div class="address">${addr(data.cliente.endereco)}</div>` : ""}
      ${!data.hideValues && (data.cliente?.telefone || data.cliente?.celular || data.cliente?.email)
        ? `
        <div class="contact">${[
          data.cliente.telefone && "Tel: " + data.cliente.telefone,
          data.cliente.celular && "Cel: " + data.cliente.celular,
          data.cliente.email && data.cliente.email,
        ]
          .filter(Boolean)
          .join(" · ")}</div>
      `
        : ""}
    </div>
  </div>
  <div>
    ${data.transportador
      ? `
      <div class="ship-card">
        <div class="card-title">Envio</div>
        ${data.transportador.nome ? `<div class="ship-row"><span class="ship-label">Transportador</span><span class="ship-val">${data.transportador.nome}</span></div>` : ""}
        ${data.transportador.formaEnvio ? `<div class="ship-row"><span class="ship-label">Forma de envio</span><span class="ship-val">${data.transportador.formaEnvio}</span></div>` : ""}
        ${data.transportador.codigoRastreamento ? `<div class="ship-row"><span class="ship-label">Rastreamento</span><span class="ship-val" style="font-family:monospace;font-size:10px;">${data.transportador.codigoRastreamento}</span></div>` : ""}
      </div>
    `
      : `
      <div class="card">
        <div class="card-title">Envio</div>
        <div class="detail">Informações de envio não disponíveis</div>
      </div>
    `}
    ${data.dataPrevista || data.dataEnvio
      ? `
      <div style="margin-top:8px;font-size:10px;color:#6b7280;">
        ${data.dataPrevista ? "Previsão: " + fmtDate(data.dataPrevista) : ""}
        ${data.dataPrevista && data.dataEnvio ? " · " : ""}
        ${data.dataEnvio ? "Enviado: " + fmtDate(data.dataEnvio) : ""}
      </div>
    `
      : ""}
  </div>
</div>

<!-- ENDEREÇO DE ENTREGA -->
${data.enderecoEntrega?.endereco
  ? `
  <div class="delivery-card">
    <div class="card-title">Endereço de Entrega (diferente do cadastro)</div>
    ${data.enderecoEntrega.nomeDestinatario ? `<strong>${data.enderecoEntrega.nomeDestinatario}</strong> — ` : ""}
    ${addr(data.enderecoEntrega)}
  </div>
`
  : ""}

<!-- ITENS PERSONALIZADOS -->
${itemTable(data.personalizedItems ?? [], "#0f766e", "Itens Personalizados")}

<!-- OUTROS ITENS -->
${itemTable(data.otherItems ?? [], "#4b5563", "Outros Itens do Pedido")}

<!-- TOTAIS -->
${showV
  ? `
  <div class="totals">
    <div class="card-title">Totais</div>
    <div class="tot-row"><span>Produtos (${data.totalItems ?? 0} itens)</span><span>${fmtBRL(data.valorTotalProdutos)}</span></div>
    ${(data.valorDesconto ?? 0) > 0 ? `<div class="tot-row" style="color:#dc2626;"><span>Desconto</span><span>- ${fmtBRL(data.valorDesconto)}</span></div>` : ""}
    ${(data.valorFrete ?? 0) > 0 ? `<div class="tot-row"><span>Frete</span><span>${fmtBRL(data.valorFrete)}</span></div>` : ""}
    <div class="tot-row grand"><span>Total do Pedido</span><span>${fmtBRL(data.valorTotalPedido)}</span></div>
  </div>
`
  : ""}

<!-- OBSERVAÇÕES -->
${data.observacoes || data.observacoesInternas
  ? `
  <div style="margin-bottom:18px;">
    <div class="section-title">Observações</div>
    ${data.observacoes ? `<div class="obs obs-pub">${data.observacoes}</div>` : ""}
    ${data.observacoesInternas ? `<div class="obs obs-int"><strong>Interna:</strong> ${data.observacoesInternas}</div>` : ""}
  </div>
`
  : ""}

<!-- FOOTER -->
<div class="footer">
  <div class="footer-left">
    ${data.deposito?.nome ? `<span class="footer-badge">${data.deposito.nome}</span>` : ""}
    ${data.vendedor?.nome ? `<span class="footer-badge">Vendedor: ${data.vendedor.nome}</span>` : ""}
  </div>
  <div class="footer-right">Impresso em ${today} · personalizadas.adds.com.br</div>
</div>

</body></html>`;

    const w = window.open("", "_blank", "width=800,height=1100");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-xl font-bold">
                    Pedido Tiny #{data.numeroPedido}
                  </SheetTitle>
                  <SheetDescription className="mt-1">
                    CRM #{data.crmOrderNumber ?? "—"} · {formatDate(data.data)}
                  </SheetDescription>
                </div>
                <div className="flex min-w-0 w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-initial">
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
                  {showUnlinkTiny && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      type="button"
                      onClick={() => setShowUnlinkConfirm(true)}
                      disabled={unlinkTinyMutation.isPending}
                      title="Desvincular pedido do Tiny"
                    >
                      {unlinkTinyMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unlink className="h-3.5 w-3.5" />
                      )}
                      {unlinkTinyMutation.isPending ? "Desvinculando..." : "Desvincular"}
                    </Button>
                  )}
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
      {showUnlinkTiny && (
        <AlertDialog open={showUnlinkConfirm} onOpenChange={setShowUnlinkConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desvincular pedido do Tiny?</AlertDialogTitle>
              <AlertDialogDescription>
                Isto vai remover o vínculo entre o pedido CRM #{data?.crmOrderNumber ?? "—"} e o pedido Tiny #{data?.numeroPedido}.
                <br /><br />
                O pedido continuará existindo no Tiny e no CRM, mas deixarão de estar conectados. Use esta ação quando o vínculo foi feito para o pedido errado.
                <br /><br />
                <strong>Esta ação é registrada no histórico do pedido.</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={unlinkTinyMutation.isPending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  unlinkTinyMutation.mutate();
                }}
                disabled={unlinkTinyMutation.isPending}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {unlinkTinyMutation.isPending ? "Desvinculando..." : "Sim, desvincular"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Sheet>
  );
}
