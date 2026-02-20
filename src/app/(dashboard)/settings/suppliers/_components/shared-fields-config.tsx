"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { SharedFields } from "@/services/bling.service";

const FIELD_LABELS: Record<keyof SharedFields, string> = {
  client_name: "Nome do cliente",
  client_document: "CPF/CNPJ",
  client_street: "Logradouro",
  client_number: "Número",
  client_complement: "Complemento",
  client_neighborhood: "Bairro",
  client_city: "Cidade",
  client_state: "Estado (UF)",
  client_zip_code: "CEP",
  order_products: "Produtos do pedido",
  order_quantities: "Quantidades",
  order_personalization: "Personalização",
  order_due_date: "Prazo de entrega",
};

interface SharedFieldsConfigProps {
  value: SharedFields;
  onChange: (value: SharedFields) => void;
  disabled?: boolean;
}

export function SharedFieldsConfig({
  value,
  onChange,
  disabled = false,
}: SharedFieldsConfigProps) {
  const handleToggle = (key: keyof SharedFields, checked: boolean) => {
    onChange({ ...value, [key]: checked });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-amber-600 dark:text-amber-500">
        Atenção: campos desativados NÃO serão enviados ao fornecedor.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(FIELD_LABELS) as (keyof SharedFields)[]).map((key) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-lg border border-border p-3"
          >
            <Label htmlFor={`field-${key}`} className="cursor-pointer text-sm">
              {FIELD_LABELS[key]}
            </Label>
            <Switch
              id={`field-${key}`}
              checked={!!value[key]}
              onCheckedChange={(checked) => handleToggle(key, !!checked)}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
