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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { getQuoteById, updateQuote } from "@/services/quotes.service";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  Mail,
  User,
  Package,
  Palette,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

interface QuoteDetailSheetProps {
  quoteId: string | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

export function QuoteDetailSheet({
  quoteId,
  onClose,
  onApprove,
  onReject,
  isApproving = false,
  isRejecting = false,
}: QuoteDetailSheetProps) {
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);

  const open = !!quoteId;

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: () => getQuoteById(quoteId!),
    enabled: !!quoteId,
  });

  useEffect(() => {
    if (quote) {
      setInternalNotes(quote.internal_notes ?? "");
      setAssignedTo(quote.assigned_to ?? "");
    }
  }, [quote]);

  useEffect(() => {
    if (open) {
      createClient()
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name")
        .then(({ data }) => setProfiles(data ?? []));
    }
  }, [open]);

  const updateMutation = useMutation({
    mutationFn: (updates: { internal_notes?: string; assigned_to?: string | null }) =>
      updateQuote(quoteId!, updates),
    onSuccess: () => {
      toast.success("Orçamento atualizado.");
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: () => toast.error("Erro ao atualizar."),
  });

  const handleSaveNotes = () => {
    updateMutation.mutate({ internal_notes: internalNotes });
  };

  const handleAssign = (userId: string) => {
    setAssignedTo(userId);
    updateMutation.mutate({ assigned_to: userId || null });
  };

  const handleRejectClick = () => {
    setRejectDialogOpen(true);
    setRejectReason("");
  };

  const handleRejectConfirm = () => {
    if (quoteId) {
      onReject(quoteId, rejectReason.trim() || undefined);
      setRejectDialogOpen(false);
    }
  };

  const canApprove = quote?.status === "PENDENTE" || quote?.status === "CONTACTADO";
  const canReject = quote?.status !== "APROVADO" && quote?.status !== "REJEITADO";
  const items = (quote?.items as { product_name: string; quantity: number; unit_price: number }[]) ?? [];
  const personalization = quote?.personalization as {
    cor_impressao?: string;
    notas_especiais?: string;
    [key: string]: string | undefined;
  } | null;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-xl"
        >
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <LoadingSpinner text="Carregando orçamento..." />
            </div>
          ) : quote ? (
            <>
              <SheetHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{quote.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(quote.created_at)}
                  </span>
                </div>
                <SheetTitle>{quote.client_name}</SheetTitle>
                <SheetDescription>
                  Orçamento público #{quote.id.slice(0, 8)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div>
                  <h4 className="mb-2 flex items-center gap-2 font-medium">
                    <User className="h-4 w-4" />
                    Cliente
                  </h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{quote.client_name}</p>
                    {quote.client_email && (
                      <p className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {quote.client_email}
                      </p>
                    )}
                    {quote.client_phone && <p>Tel: {quote.client_phone}</p>}
                    {quote.client_whatsapp && (
                      <p>WhatsApp: {quote.client_whatsapp}</p>
                    )}
                    {quote.client_document && (
                      <p>CPF/CNPJ: {quote.client_document}</p>
                    )}
                    {(quote.client_street || quote.client_city) && (
                      <p>
                        {[quote.client_street, quote.client_number]
                          .filter(Boolean)
                          .join(", ")}{" "}
                        - {quote.client_neighborhood} - {quote.client_city}/
                        {quote.client_state} - {quote.client_zip_code}
                      </p>
                    )}
                    {quote.client_logo_url && (
                      <img
                        src={quote.client_logo_url}
                        alt="Logo"
                        className="mt-2 h-16 w-16 object-contain"
                      />
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-2 flex items-center gap-2 font-medium">
                    <Package className="h-4 w-4" />
                    Produtos
                  </h4>
                  <ul className="space-y-2">
                    {items.map((item, i) => (
                      <li
                        key={i}
                        className="flex justify-between text-sm"
                      >
                        <span>
                          {item.product_name} x {item.quantity}
                        </span>
                        <span>
                          {formatCurrency(
                            (item.unit_price ?? 0) * item.quantity
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 font-semibold">
                    Total:{" "}
                    {quote.estimated_value != null
                      ? formatCurrency(quote.estimated_value)
                      : "—"}
                  </p>
                </div>

                {(personalization || quote.client_social_media) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 font-medium">
                        <Palette className="h-4 w-4" />
                        Personalização
                      </h4>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {personalization?.cor_impressao && (
                          <p>Cor: {String(personalization.cor_impressao)}</p>
                        )}
                        {personalization?.notas_especiais && (
                          <p>Notas: {String(personalization.notas_especiais)}</p>
                        )}
                        {quote.client_social_media && (
                          <p>Redes sociais: {quote.client_social_media}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <h4 className="mb-2 flex items-center gap-2 font-medium">
                    <FileText className="h-4 w-4" />
                    Notas internas
                  </h4>
                  <Textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Anotações internas sobre este orçamento..."
                    rows={3}
                    className="resize-none"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleSaveNotes}
                    disabled={updateMutation.isPending}
                  >
                    Salvar notas
                  </Button>
                </div>

                <div>
                  <Label className="text-sm">Atribuído a</Label>
                  <Select
                    value={assignedTo || "__none__"}
                    onValueChange={(v) =>
                      handleAssign(v === "__none__" ? "" : v)
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2">
                  {canApprove && (
                    <Button
                      onClick={() => onApprove(quote.id)}
                      disabled={isApproving}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Aprovar (criar pedido)
                    </Button>
                  )}
                  {canReject && (
                    <Button
                      variant="destructive"
                      onClick={handleRejectClick}
                      disabled={isRejecting}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Rejeitar
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <a
                      href={
                        quote.client_email
                          ? `mailto:${quote.client_email}`
                          : "#"
                      }
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Contactar
                    </a>
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar orçamento</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição (opcional). O cliente não verá esta
              informação.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo da rejeição..."
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={isRejecting}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
