"use client";

import type { QuoteRegisterFormData } from "@/lib/validations";
import type { QuoteItem } from "./step-products";
import type { PersonalizationData } from "./step-personalization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Pencil, User, Package, Palette } from "lucide-react";

interface StepConfirmationProps {
  registerData: QuoteRegisterFormData;
  items: QuoteItem[];
  total: number;
  personalization: PersonalizationData;
  onEdit: (step: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function StepConfirmation({
  registerData,
  items,
  total,
  personalization,
  onEdit,
  onSubmit,
  isSubmitting,
}: StepConfirmationProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Dados do cliente
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEdit(2)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{registerData.nome}</p>
          <p>{registerData.email}</p>
          <p>{registerData.telefone}</p>
          {registerData.whatsapp && <p>WhatsApp: {registerData.whatsapp}</p>}
          <p>
            {registerData.rua}, {registerData.numero} - {registerData.bairro}
          </p>
          <p>
            {registerData.cidade} - {registerData.estado} - {registerData.cep}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Produtos
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEdit(3)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.product_id} className="flex justify-between">
                <span>
                  {item.product_name} x {item.quantity}
                </span>
                <span>{formatCurrency(item.unit_price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 font-semibold">Total: {formatCurrency(total)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Personalização
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEdit(4)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {personalization.cor_impressao && (
            <p>Cor: {CORES.find((c) => c.value === personalization.cor_impressao)?.label}</p>
          )}
          {personalization.redes_sociais && (
            <p>Redes sociais: {personalization.redes_sociais}</p>
          )}
          {personalization.notas_especiais && (
            <p>Notas: {personalization.notas_especiais}</p>
          )}
          {personalization.logo_url && <p>Logo: enviado</p>}
          {!personalization.cor_impressao &&
            !personalization.redes_sociais &&
            !personalization.notas_especiais &&
            !personalization.logo_url && <p>Nenhuma</p>}
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full"
        onClick={onSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Enviando..." : "Enviar Orçamento"}
      </Button>
    </div>
  );
}

const CORES = [
  { value: "1c", label: "1 cor" },
  { value: "2c", label: "2 cores" },
  { value: "4c", label: "4 cores" },
  { value: "full", label: "Full color" },
];
