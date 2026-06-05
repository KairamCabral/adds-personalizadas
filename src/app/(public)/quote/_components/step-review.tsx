"use client";

import {
  ArrowLeft,
  Loader2,
  Send,
  Pencil,
  Package,
  User,
  Truck,
  Check,
  X,
  CreditCard,
  Palette,
  Copy,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { recalculateQuote } from "@/lib/pricing";
import type {
  WizardClientData,
  WizardProductItem,
  WizardPersonalization,
} from "./quote-wizard-types";
import type { ProductCatalogItem, PricingContext } from "@/lib/pricing";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface StepReviewProps {
  clientData: WizardClientData;
  products: WizardProductItem[];
  productCatalog: ProductCatalogItem[];
  personalization: WizardPersonalization;
  pricingContext?: PricingContext;
  onSubmit: () => void;
  isSubmitting: boolean;
  onBack: () => void;
  onEditClient: () => void;
  onEditProducts: () => void;
  onEditPersonalization: () => void;
}

export function StepReview({
  clientData,
  products,
  productCatalog,
  personalization,
  pricingContext,
  onSubmit,
  isSubmitting,
  onBack,
  onEditClient,
  onEditProducts,
  onEditPersonalization,
}: StepReviewProps) {
  const quote = recalculateQuote(products, productCatalog, pricingContext);

  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto min-w-0">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Revisão do Orçamento</h2>
        <p className="text-muted-foreground">
          Confira todos os dados antes de enviar
        </p>
      </div>

      {/* 1. Produtos e orçamento */}
      <Card className="rounded-xl border-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Produtos e orçamento
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEditProducts}
            className="gap-1.5 text-xs"
          >
            <Pencil className="h-3 w-3" /> Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {quote.items.map((line) => {
            const orig = products.find((p) => p.product_id === line.product_id);
            const qpc = orig?.quantity_per_color && Object.keys(orig.quantity_per_color).length > 0
              ? orig.quantity_per_color
              : null;
            return (
              <div
                key={line.product_id}
                className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{line.product_name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(line.unitPrice)}/un
                    </span>
                    <Badge variant="default" className="tabular-nums">
                      {line.quantity} un
                    </Badge>
                    <span className="text-sm font-semibold tabular-nums min-w-[4.5rem] text-right">
                      {formatCurrency(line.subtotal)}
                    </span>
                  </div>
                </div>
                {qpc ? (
                  <p className="text-xs text-muted-foreground">
                    {Object.entries(qpc)
                      .filter(([, q]) => q > 0)
                      .map(([cor, q]) => `${cor}: ${q}`)
                      .join(" · ")}
                  </p>
                ) : orig && (
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {orig.colors.map((c) => (
                      <Badge key={c} variant="secondary" className="text-xs">
                        {c}
                      </Badge>
                    ))}
                    {orig.custom_color && (
                      <Badge variant="outline" className="text-xs">
                        {orig.custom_color}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {quote.items.length > 0 && (
            <div className="mt-4 pt-4 border-t space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">{formatCurrency(quote.subtotal)}</span>
              </div>
              {quote.volumeDiscountPct > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Desconto por volume ({quote.volumeDiscountPct}%)
                  </span>
                  <span className="text-green-600 dark:text-green-400 tabular-nums">
                    -{formatCurrency(quote.volumeDiscountValue)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Desconto PIX/Boleto ({Math.round(quote.pixDiscountRate * 100)}%)
                </span>
                <span className="text-green-600 dark:text-green-400 tabular-nums">
                  -{formatCurrency(quote.pixDiscountValue)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">À vista</p>
                  <p className="text-lg font-bold tabular-nums text-primary">
                    {formatCurrency(quote.totalPix)}
                  </p>
                  <p className="text-xs text-muted-foreground">PIX ou Boleto</p>
                </div>
                <div className="rounded-lg bg-muted/50 border border-border p-3 flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">Cartão</p>
                  </div>
                  <p className="text-base font-semibold tabular-nums">
                    4x de {formatCurrency(quote.installment4x)}
                  </p>
                  <p className="text-xs text-muted-foreground">sem juros</p>
                </div>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {quote.freteGratis ? (
                  <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                    <Check className="h-3 w-3" /> Frete grátis
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400 border-amber-500/50">
                    <Truck className="h-3 w-3" /> Mín. 12 un ou R$ 200 para frete grátis
                  </Badge>
                )}
                {quote.personalizacaoDisponivel ? (
                  <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/30">
                    <Check className="h-3 w-3" /> Personalização grátis
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <X className="h-3 w-3" /> Mín. 24 un ou R$ 480 para personalizar
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Personalização */}
      <Card className="rounded-xl border-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Personalização
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEditPersonalization}
            className="gap-1.5 text-xs"
          >
            <Pencil className="h-3 w-3" /> Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {personalization.artwork_mode === "use_last" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
              <Copy className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <div>
                <p className="font-medium">Usar última arte</p>
                {personalization.notes && (
                  <p className="text-muted-foreground mt-1">
                    {personalization.notes}
                  </p>
                )}
              </div>
            </div>
          )}
          {personalization.artwork_mode === "request_creation" && (
            <>
              {personalization.print_color && (
                <p>
                  <span className="text-muted-foreground">Cor de impressão:</span>{" "}
                  {personalization.print_color}
                </p>
              )}
              {personalization.custom_color && (
                <p>
                  <span className="text-muted-foreground">Cor personalizada:</span>{" "}
                  {personalization.custom_color}
                </p>
              )}
              {personalization.notes && (
                <p>
                  <span className="text-muted-foreground">Observações:</span>{" "}
                  {personalization.notes}
                </p>
              )}
              {personalization.logo_file && (
                <div className="flex items-center gap-2 mt-2">
                  <ImageIcon className="h-4 w-4 text-green-500" />
                  <span className="text-green-500 text-sm">
                    {personalization.logo_file.name} ({(personalization.logo_file.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              )}
              {!personalization.print_color &&
                !personalization.custom_color &&
                !personalization.notes &&
                !personalization.logo_file && (
                  <p className="text-muted-foreground italic">Solicitar criação da arte</p>
                )}
            </>
          )}
          {personalization.artwork_mode === "do_it_yourself" &&
            personalization.diy_customizations.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  Faça Você Mesmo
                </p>
                {personalization.diy_customizations.map((c, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-muted/30 space-y-1"
                  >
                    <p className="font-medium text-xs text-muted-foreground">
                      {c.product_name}
                    </p>
                    {c.line1 && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Linha 1:</span>{" "}
                        {c.line1}
                      </p>
                    )}
                    {c.line2 && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Linha 2:</span>{" "}
                        {c.line2}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground capitalize">
                      Impressão: {c.print_color}
                    </p>
                    {c.logo_file && (
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Logo anexado
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          {!personalization.artwork_mode && (
            <p className="text-muted-foreground italic">Nenhuma personalização informada</p>
          )}
        </CardContent>
      </Card>

      {/* 3. Dados */}
      <Card className="rounded-xl border-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Dados
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEditClient}
            className="gap-1.5 text-xs"
          >
            <Pencil className="h-3 w-3" /> Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-medium">{clientData.client_name}</p>
          {clientData.client_whatsapp && (
            <p className="text-muted-foreground">
              WhatsApp: {clientData.client_whatsapp}
            </p>
          )}
          {clientData.client_phone && (
            <p className="text-muted-foreground">
              Tel: {clientData.client_phone}
            </p>
          )}
          {clientData.client_email && (
            <p className="text-muted-foreground">{clientData.client_email}</p>
          )}
          {clientData.client_document && (
            <p className="text-muted-foreground">
              {clientData.client_document}
            </p>
          )}
          {clientData.client_city && (
            <p className="text-muted-foreground">
              {[
                clientData.client_street,
                clientData.client_number,
                clientData.client_neighborhood,
                clientData.client_city,
                clientData.client_state,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
          {clientData.client_social_media && (
            <p className="text-muted-foreground">
              {clientData.client_social_media}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="rounded-xl bg-primary/10 border-2 border-primary/25 p-5 sm:p-6">
        <p className="text-base sm:text-lg text-foreground/95 leading-relaxed font-medium">
          Nossa equipe criará sua arte em até <strong className="text-primary">3 dias úteis</strong> e entrará em contato pelo WhatsApp para enviar a arte para revisão e aprovação.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          size="lg"
          className="gap-2 h-12 font-semibold bg-primary hover:bg-primary/90"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Enviar Orçamento
        </Button>
      </div>
    </div>
  );
}
