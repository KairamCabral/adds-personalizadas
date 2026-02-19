"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getQuotes,
  approveQuote,
  rejectQuote,
  type QuoteStatus,
} from "@/services/quotes.service";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuoteDetailSheet } from "./_components/quote-detail-sheet";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { PublicQuote } from "@/types/database.types";
import {
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

const QUOTE_STATUSES: { value: QuoteStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "PENDENTE", label: "Pendente" },
  { value: "CONTACTADO", label: "Contactado" },
  { value: "CONCLUIDO", label: "Concluído" },
  { value: "APROVADO", label: "Aprovado" },
  { value: "REJEITADO", label: "Rejeitado" },
];

const STATUS_VARIANTS: Record<QuoteStatus, "default" | "secondary" | "destructive" | "outline"> = {
  PENDENTE: "secondary",
  CONTACTADO: "outline",
  CONCLUIDO: "default",
  APROVADO: "default",
  REJEITADO: "destructive",
};

export default function QuotesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "all">("all");
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["quotes", statusFilter === "all" ? undefined : statusFilter],
    queryFn: () =>
      getQuotes({
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const approveMutation = useMutation({
    mutationFn: approveQuote,
    onSuccess: () => {
      toast.success("Orçamento aprovado. Pedido criado no Kanban.");
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedQuoteId(null);
    },
    onError: () => {
      toast.error("Erro ao aprovar orçamento.");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectQuote(id, reason),
    onSuccess: () => {
      toast.success("Orçamento rejeitado.");
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setRejectTargetId(null);
      setSelectedQuoteId(null);
    },
    onError: () => {
      toast.error("Erro ao rejeitar orçamento.");
    },
  });

  const quotes = data?.data ?? [];

  const columns = [
    {
      accessorKey: "client_name" as const,
      header: "Cliente",
      cell: ({ row }: { row: { original: PublicQuote } }) => (
        <div>
          <p className="font-medium">{row.original.client_name}</p>
          {row.original.client_email && (
            <p className="text-xs text-muted-foreground">
              {row.original.client_email}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "items" as const,
      header: "Produtos",
      cell: ({ row }: { row: { original: PublicQuote } }) => {
        const items = (row.original.items as { product_name: string }[]) ?? [];
        const names = items.slice(0, 2).map((i) => i.product_name);
        const extra = items.length > 2 ? ` +${items.length - 2}` : "";
        return (
          <div className="flex flex-wrap gap-1">
            {names.map((n) => (
              <Badge key={n} variant="outline" className="text-xs">
                {n}
              </Badge>
            ))}
            {extra && (
              <span className="text-xs text-muted-foreground">{extra}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "estimated_value" as const,
      header: "Valor",
      cell: ({ row }: { row: { original: PublicQuote } }) => (
        <span className="font-medium">
          {row.original.estimated_value != null
            ? formatCurrency(row.original.estimated_value)
            : "—"}
        </span>
      ),
    },
    {
      accessorKey: "status" as const,
      header: "Status",
      cell: ({ row }: { row: { original: PublicQuote } }) => (
        <Badge variant={STATUS_VARIANTS[row.original.status as QuoteStatus]}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at" as const,
      header: "Data",
      cell: ({ row }: { row: { original: PublicQuote } }) => (
        <span className="text-muted-foreground text-sm">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "actions" as const,
      header: "",
      cell: ({ row }: { row: { original: PublicQuote } }) => {
        const quote = row.original;
        const canApprove = quote.status === "PENDENTE" || quote.status === "CONTACTADO";
        const canReject = quote.status !== "APROVADO" && quote.status !== "REJEITADO";

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Ações</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedQuoteId(quote.id)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver detalhes
              </DropdownMenuItem>
              {canApprove && (
                <DropdownMenuItem
                  onClick={() => approveMutation.mutate(quote.id)}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Aprovar
                </DropdownMenuItem>
              )}
              {canReject && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setRejectTargetId(quote.id)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Rejeitar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Orçamentos Públicos"
        description="Gerencie orçamentos enviados pelo formulário público"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as QuoteStatus | "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            {QUOTE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-12">
          <LoadingSpinner text="Carregando orçamentos..." />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={quotes}
          emptyMessage="Nenhum orçamento encontrado"
        />
      )}

      <QuoteDetailSheet
        quoteId={selectedQuoteId}
        onClose={() => setSelectedQuoteId(null)}
        onApprove={(id) => approveMutation.mutate(id)}
        onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
        isApproving={approveMutation.isPending}
        isRejecting={rejectMutation.isPending}
      />

      <ConfirmDialog
        open={!!rejectTargetId}
        onOpenChange={(open) => !open && setRejectTargetId(null)}
        title="Rejeitar orçamento"
        description="Deseja rejeitar este orçamento? Você pode informar um motivo (opcional)."
        confirmLabel="Rejeitar"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={() => {
          if (rejectTargetId) {
            rejectMutation.mutate({ id: rejectTargetId });
            setRejectTargetId(null);
          }
        }}
      />
    </div>
  );
}
