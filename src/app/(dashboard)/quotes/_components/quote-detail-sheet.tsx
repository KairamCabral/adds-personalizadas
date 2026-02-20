"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Phone,
  Mail,
  MapPin,
  Package,
  MessageCircle,
  CheckCircle2,
  XCircle,
  PhoneCall,
  ExternalLink,
  FileText,
  Globe,
  Copy,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import {
  getQuoteById,
  updateQuote,
  approveQuote,
  rejectQuote,
  markAsContacted,
  type QuoteStatus,
  type QuoteItem,
} from "@/services/quotes.service";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

const STATUS_CONFIG: Record<
  QuoteStatus,
  { label: string; className: string }
> = {
  PENDENTE: {
    label: "Pendente",
    className: "border-amber-500/50 text-amber-500 bg-amber-500/10",
  },
  CONTACTADO: {
    label: "Contactado",
    className: "border-blue-500/50 text-blue-500 bg-blue-500/10",
  },
  CONCLUIDO: {
    label: "Concluído",
    className: "border-cyan-500/50 text-cyan-500 bg-cyan-500/10",
  },
  APROVADO: {
    label: "Aprovado",
    className: "border-green-500/50 text-green-500 bg-green-500/10",
  },
  REJEITADO: {
    label: "Rejeitado",
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

function formatDocument(doc: string | null) {
  if (!doc) return null;
  const clean = doc.replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (clean.length === 14) {
    return clean.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  }
  return doc;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copiado!`);
}

interface QuoteDetailSheetProps {
  quoteId: string | null;
  open: boolean;
  onClose: () => void;
}

export function QuoteDetailSheet({
  quoteId,
  open,
  onClose,
}: QuoteDetailSheetProps) {
  const queryClient = useQueryClient();
  const [internalNotes, setInternalNotes] = useState("");
  const [orcamentoGerado, setOrcamentoGerado] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: () => getQuoteById(quoteId!),
    enabled: !!quoteId && open,
  });

  useEffect(() => {
    if (quote) {
      setInternalNotes(quote.internal_notes || "");
      setOrcamentoGerado(quote.estimated_value != null ? String(quote.estimated_value) : "");
    }
  }, [quote]);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["quotes"] });
    queryClient.invalidateQueries({ queryKey: ["quote-counts"] });
    queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
  };

  const approveMutation = useMutation({
    mutationFn: () => approveQuote(quoteId!),
    onSuccess: (order: { order_number?: number }) => {
      toast.success("Orçamento aprovado!", {
        description: `Pedido #${order.order_number ?? ""} criado no Pipeline`,
      });
      invalidateQueries();
      onClose();
    },
    onError: (error) => {
      toast.error("Erro ao aprovar orçamento", {
        description:
          error instanceof Error ? error.message : "Tente novamente",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectQuote(quoteId!, rejectReason),
    onSuccess: () => {
      toast.success("Orçamento rejeitado");
      setRejectReason("");
      invalidateQueries();
      onClose();
    },
    onError: (error) => {
      toast.error("Erro ao rejeitar", {
        description:
          error instanceof Error ? error.message : "Tente novamente",
      });
    },
  });

  const contactMutation = useMutation({
    mutationFn: () => markAsContacted(quoteId!),
    onSuccess: () => {
      toast.success("Marcado como contactado");
      invalidateQueries();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar", {
        description:
          error instanceof Error ? error.message : "Tente novamente",
      });
    },
  });

  const saveNotesMutation = useMutation({
    mutationFn: () =>
      updateQuote(quoteId!, {
        internal_notes: internalNotes || null,
        estimated_value: orcamentoGerado ? parseFloat(orcamentoGerado.replace(",", ".")) : null,
      }),
    onSuccess: () => {
      toast.success("Notas salvas");
      invalidateQueries();
    },
    onError: (error) => {
      toast.error("Erro ao salvar", {
        description:
          error instanceof Error ? error.message : "Tente novamente",
      });
    },
  });

  const isActionDisabled =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    contactMutation.isPending;

  if (!quoteId) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto p-0">
        {isLoading || !quote ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <SheetHeader className="p-6 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(quote.client_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="text-lg">
                      {quote.client_name}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground">
                      Enviado{" "}
                      {formatDistanceToNow(new Date(quote.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={STATUS_CONFIG[quote.status].className}
                >
                  {STATUS_CONFIG[quote.status].label}
                </Badge>
              </div>
            </SheetHeader>

            <Separator />

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Dados do Cliente
                </h3>
                <div className="space-y-2.5">
                  {(quote.client_phone || quote.client_whatsapp) && (
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {quote.client_phone || quote.client_whatsapp}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            copyToClipboard(
                              (quote.client_phone || quote.client_whatsapp)!,
                              "Telefone"
                            )
                          }
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-500"
                          asChild
                        >
                          <a
                            href={`https://wa.me/55${(
                              quote.client_whatsapp ||
                              quote.client_phone ||
                              ""
                            ).replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                  {quote.client_email && (
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{quote.client_email}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            copyToClipboard(quote.client_email!, "E-mail")
                          }
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          asChild
                        >
                          <a href={`mailto:${quote.client_email}`}>
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                  {quote.client_document && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDocument(quote.client_document)}</span>
                    </div>
                  )}

                  {(quote.client_city || quote.client_state) && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {[
                          quote.client_street,
                          quote.client_number,
                          quote.client_neighborhood,
                          quote.client_city,
                          quote.client_state,
                          quote.client_zip_code,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}

                  {quote.client_social_media && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span>{quote.client_social_media}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Produtos Solicitados
                </h3>
                <div className="space-y-2">
                  {(Array.isArray(quote.items) ? quote.items : []).map(
                    (item: QuoteItem, index: number) => {
                      const qpc = item.quantity_per_color && Object.keys(item.quantity_per_color).length > 0
                        ? item.quantity_per_color
                        : null;
                      const colorsText = qpc
                        ? Object.entries(qpc)
                            .filter(([, q]) => q > 0)
                            .map(([cor, q]) => `${cor}: ${q}`)
                            .join(", ")
                        : item.colors && item.colors.length > 0
                          ? item.colors.join(", ")
                          : null;
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                              <Package className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {item.product_name}
                              </p>
                              {colorsText && (
                                <p className="text-xs text-muted-foreground">
                                  Cores: {colorsText}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge variant="secondary" className="tabular-nums">
                            {item.quantity} un
                          </Badge>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {(quote.personalization || quote.client_logo_url) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Personalização
                    </h3>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                      {quote.personalization?.artwork_mode === "use_last" && (
                        <p className="text-sm font-medium">Usar última arte</p>
                      )}
                      {quote.personalization?.artwork_mode === "request_creation" && (
                        <p className="text-sm font-medium">Solicitar criação da arte</p>
                      )}
                      {quote.personalization?.artwork_mode === "do_it_yourself" && (
                        <p className="text-sm font-medium">Faça você mesmo</p>
                      )}
                      {quote.personalization?.notes && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Informações:</span>{" "}
                          {quote.personalization.notes}
                        </p>
                      )}
                      {quote.personalization?.print_color && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Cor de impressão:</span>{" "}
                          {quote.personalization.print_color}
                        </p>
                      )}
                      {quote.personalization?.custom_color && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Cor personalizada:</span>{" "}
                          {quote.personalization.custom_color}
                        </p>
                      )}
                      {quote.client_logo_url && (
                        <div className="flex items-center gap-2 pt-1">
                          <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <a
                            href={quote.client_logo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            Ver logo do cliente
                          </a>
                        </div>
                      )}
                      {!quote.personalization?.artwork_mode &&
                        !quote.personalization?.notes &&
                        !quote.personalization?.print_color &&
                        !quote.personalization?.custom_color &&
                        !quote.client_logo_url && (
                          <p className="text-sm text-muted-foreground italic">
                            Nenhuma personalização informada
                          </p>
                        )}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Gestão Interna
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="orcamento_gerado" className="text-sm">
                      Orçamento gerado
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        R$
                      </span>
                      <Input
                        id="orcamento_gerado"
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        className="pl-10"
                        value={orcamentoGerado}
                        onChange={(e) => setOrcamentoGerado(e.target.value.replace(/[^\d,.-]/g, ""))}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Valor do orçamento para registro interno (não é enviado ao pedido)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="internal_notes" className="text-sm">
                      Notas Internas
                    </Label>
                    <Textarea
                      id="internal_notes"
                      placeholder="Observações internas sobre este orçamento..."
                      rows={3}
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveNotesMutation.mutate()}
                    disabled={saveNotesMutation.isPending}
                  >
                    {saveNotesMutation.isPending ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Salvar notas
                  </Button>
                </div>
              </div>

              {quote.order_id && (
                <>
                  <Separator />
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-green-500">
                          Pedido criado no Pipeline
                        </span>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/pipeline?order=${quote.order_id}`}>
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          Abrir pedido
                        </a>
                      </Button>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {quote.status !== "APROVADO" && quote.status !== "REJEITADO" && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Ações
                  </h3>

                  <div className="flex flex-wrap gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          className="bg-green-600 hover:bg-green-700 text-white gap-2"
                          disabled={isActionDisabled}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Aprovar e criar pedido
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Aprovar orçamento?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso vai criar automaticamente um pedido no Pipeline
                            com os dados deste orçamento e o cliente será
                            cadastrado (se ainda não existir).
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => approveMutation.mutate()}
                          >
                            {approveMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Confirmar aprovação
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {quote.status === "PENDENTE" && (
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => contactMutation.mutate()}
                        disabled={isActionDisabled}
                      >
                        {contactMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PhoneCall className="h-4 w-4" />
                        )}
                        Marcar contactado
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="gap-2 border-red-500/50 text-red-500 hover:bg-red-500/10"
                          disabled={isActionDisabled}
                        >
                          <XCircle className="h-4 w-4" />
                          Rejeitar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Rejeitar orçamento?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Deseja rejeitar este orçamento? Você pode informar
                            o motivo abaixo.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Textarea
                          placeholder="Motivo da rejeição (opcional)..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={3}
                        />
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => rejectMutation.mutate()}
                          >
                            {rejectMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Confirmar rejeição
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
