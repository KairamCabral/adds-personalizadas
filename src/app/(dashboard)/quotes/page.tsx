"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import {
  getQuotesViaApi,
  getQuoteCounts,
  type QuoteStatus,
} from "@/services/quotes.service";
import { QuotesTable } from "./_components/quotes-table";
import { QuoteDetailSheet } from "./_components/quote-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "PENDENTE_CONTACTADO", label: "Pendentes e Contactados" },
  { value: "ALL", label: "Todos" },
  { value: "PENDENTE", label: "Pendentes" },
  { value: "CONTACTADO", label: "Contactados" },
  { value: "CONCLUIDO", label: "Concluídos" },
  { value: "APROVADO", label: "Aprovados" },
  { value: "REJEITADO", label: "Rejeitados" },
] as const;

export default function QuotesPage() {
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "ALL" | "PENDENTE_CONTACTADO">(
    "PENDENTE_CONTACTADO"
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["quotes", statusFilter, search, page],
    queryFn: () => getQuotesViaApi({ status: statusFilter, search, page }),
  });

  const { data: counts } = useQuery({
    queryKey: ["quote-counts"],
    queryFn: getQuoteCounts,
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as QuoteStatus | "ALL" | "PENDENTE_CONTACTADO");
    setPage(1);
  };

  const handleCopyFormLink = () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/quote`
        : "/quote";
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!", {
      description: "O link do formulário de orçamento foi copiado para a área de transferência.",
    });
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Orçamentos Públicos
            </h1>
            {counts && counts.PENDENTE > 0 && (
              <Badge variant="default" className="bg-amber-500 text-white">
                {counts.PENDENTE} pendente{counts.PENDENTE > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Gerencie orçamentos enviados pelo formulário público
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleCopyFormLink}
        >
          <FileText className="h-4 w-4" />
          Link do formulário
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  {option.label}
                  {option.value === "PENDENTE_CONTACTADO" &&
                    counts &&
                    (counts.PENDENTE + counts.CONTACTADO) > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 py-0"
                      >
                        {counts.PENDENTE + counts.CONTACTADO}
                      </Badge>
                    )}
                  {option.value !== "ALL" &&
                    option.value !== "PENDENTE_CONTACTADO" &&
                    counts &&
                    counts[option.value as QuoteStatus] > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 py-0"
                      >
                        {counts[option.value as QuoteStatus]}
                      </Badge>
                    )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Buscar por nome, e-mail, telefone ou documento..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {counts && (
          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground ml-auto">
            <span>{counts.TOTAL} total</span>
            <span>·</span>
            <span className="text-amber-500">{counts.PENDENTE} pendentes</span>
            <span>·</span>
            <span className="text-green-500">{counts.APROVADO} aprovados</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div>
            <p className="text-destructive text-lg font-medium">
              Erro ao carregar orçamentos
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {error instanceof Error ? error.message : "Tente novamente"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <QuotesTable
          quotes={data?.quotes ?? []}
          total={data?.total ?? 0}
          page={page}
          totalPages={data?.totalPages ?? 0}
          onPageChange={setPage}
          onSelectQuote={setSelectedQuoteId}
        />
      )}

      <QuoteDetailSheet
        quoteId={selectedQuoteId}
        open={!!selectedQuoteId}
        onClose={() => setSelectedQuoteId(null)}
      />
    </div>
  );
}
