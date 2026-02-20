"use client";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MoreHorizontal,
  Eye,
  MessageCircle,
  Mail,
  ExternalLink,
} from "lucide-react";
import {
  type PublicQuote,
  type QuoteStatus,
  type QuoteItem,
} from "@/services/quotes.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STATUS_CONFIG: Record<
  QuoteStatus,
  { label: string; variant: string; className: string }
> = {
  PENDENTE: {
    label: "Pendente",
    variant: "outline",
    className: "border-amber-500/50 text-amber-500 bg-amber-500/10",
  },
  CONTACTADO: {
    label: "Contactado",
    variant: "outline",
    className: "border-blue-500/50 text-blue-500 bg-blue-500/10",
  },
  CONCLUIDO: {
    label: "Concluído",
    variant: "outline",
    className: "border-cyan-500/50 text-cyan-500 bg-cyan-500/10",
  },
  APROVADO: {
    label: "Aprovado",
    variant: "outline",
    className: "border-green-500/50 text-green-500 bg-green-500/10",
  },
  REJEITADO: {
    label: "Rejeitado",
    variant: "outline",
    className: "border-red-500/50 text-red-500 bg-red-500/10",
  },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatCurrency(value: number | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatProducts(items: QuoteItem[] | unknown) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return "—";
  return list
    .map((item) => `${item.product_name} (${item.quantity})`)
    .join(" · ");
}

interface QuotesTableProps {
  quotes: PublicQuote[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelectQuote: (id: string) => void;
}

export function QuotesTable({
  quotes,
  total,
  page,
  totalPages,
  onPageChange,
  onSelectQuote,
}: QuotesTableProps) {
  if (quotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium">Nenhum orçamento encontrado</p>
        <p className="text-muted-foreground text-sm mt-1">
          Os orçamentos aparecerão aqui quando clientes enviarem pelo formulário
          público
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[280px]">Cliente</TableHead>
              <TableHead className="w-[250px]">Produtos</TableHead>
              <TableHead className="w-[120px] text-right">Valor</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[100px]">Responsável</TableHead>
              <TableHead className="w-[140px]">Data</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => {
              const statusConfig = STATUS_CONFIG[quote.status];
              const phoneForWhatsApp =
                quote.client_whatsapp || quote.client_phone || "";
              return (
                <TableRow
                  key={quote.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onSelectQuote(quote.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                          {getInitials(quote.client_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {quote.client_name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {quote.client_phone && (
                            <span className="truncate">
                              {quote.client_phone}
                            </span>
                          )}
                          {quote.client_phone && quote.client_city && (
                            <span>·</span>
                          )}
                          {quote.client_city && (
                            <span className="truncate">
                              {quote.client_city}
                              {quote.client_state
                                ? `/${quote.client_state}`
                                : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <p className="text-sm truncate max-w-[230px]">
                      {formatProducts(quote.items)}
                    </p>
                  </TableCell>

                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(quote.estimated_value)}
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusConfig.className}
                    >
                      {statusConfig.label}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    {quote.assigned_profile ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-xs bg-secondary">
                                  {getInitials(quote.assigned_profile.full_name)}
                                </AvatarFallback>
                              </Avatar>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {quote.assigned_profile.full_name}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(quote.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {new Date(quote.created_at).toLocaleString("pt-BR")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectQuote(quote.id);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver detalhes
                        </DropdownMenuItem>

                        {phoneForWhatsApp && (
                          <DropdownMenuItem asChild>
                            <a
                              href={`https://wa.me/55${phoneForWhatsApp.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle className="mr-2 h-4 w-4" />
                              WhatsApp
                            </a>
                          </DropdownMenuItem>
                        )}

                        {quote.client_email && (
                          <DropdownMenuItem asChild>
                            <a
                              href={`mailto:${quote.client_email}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              E-mail
                            </a>
                          </DropdownMenuItem>
                        )}

                        {quote.order_id && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <a
                                href={`/pipeline?order=${quote.order_id}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Ver pedido no Pipeline
                              </a>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          {total} registro{total !== 1 ? "s" : ""} no total
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
