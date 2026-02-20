"use client";

import {
  ArrowLeft,
  Loader2,
  Send,
  Pencil,
  Package,
  User,
  Palette,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  WizardClientData,
  WizardProductItem,
  WizardPersonalization,
} from "./quote-wizard-types";

interface StepReviewProps {
  clientData: WizardClientData;
  products: WizardProductItem[];
  personalization: WizardPersonalization;
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
  personalization,
  onSubmit,
  isSubmitting,
  onBack,
  onEditClient,
  onEditProducts,
  onEditPersonalization,
}: StepReviewProps) {
  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto min-w-0">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Revisão do Orçamento</h2>
        <p className="text-muted-foreground">
          Confira todos os dados antes de enviar
        </p>
      </div>

      <Card className="rounded-xl border-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Seus Dados
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

      <Card className="rounded-xl border-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Produtos
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
          {products.map((item, index) => {
            const qpc = item.quantity_per_color && Object.keys(item.quantity_per_color).length > 0
              ? item.quantity_per_color
              : null;
            const total = qpc
              ? Object.values(qpc).reduce((a, b) => a + b, 0)
              : item.quantity;
            return (
              <div
                key={index}
                className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{item.product_name}</p>
                  <Badge variant="default" className="tabular-nums">
                    {total} un
                  </Badge>
                </div>
                {qpc ? (
                  <p className="text-xs text-muted-foreground">
                    {Object.entries(qpc)
                      .filter(([, q]) => q > 0)
                      .map(([cor, q]) => `${cor}: ${q}`)
                      .join(" · ")}
                  </p>
                ) : (
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {item.colors.map((c) => (
                      <Badge key={c} variant="secondary" className="text-xs">
                        {c}
                      </Badge>
                    ))}
                    {item.custom_color && (
                      <Badge variant="outline" className="text-xs">
                        {item.custom_color}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

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
        <CardContent className="space-y-1 text-sm">
          {personalization.print_color && (
            <p>
              <span className="text-muted-foreground">
                Cor de impressão:
              </span>{" "}
              {personalization.print_color}
            </p>
          )}
          {personalization.custom_color && (
            <p>
              <span className="text-muted-foreground">
                Cor personalizada:
              </span>{" "}
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
                {personalization.logo_file.name} (
                {(personalization.logo_file.size / 1024).toFixed(0)} KB)
              </span>
            </div>
          )}
          {!personalization.print_color &&
            !personalization.custom_color &&
            !personalization.notes &&
            !personalization.logo_file && (
              <p className="text-muted-foreground italic">
                Nenhuma personalização informada
              </p>
            )}
        </CardContent>
      </Card>

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
