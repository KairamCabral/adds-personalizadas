"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { WizardClientData } from "../quote-wizard-types";

interface DiyShortcutsProps {
  clientData: WizardClientData;
  onApply: (line1: string, line2: string) => void;
}

function formatPhone(phone: string) {
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

export function DiyShortcuts({ clientData, onApply }: DiyShortcutsProps) {
  const phone = clientData.client_phone || clientData.client_whatsapp || "";
  const whatsapp = clientData.client_whatsapp || clientData.client_phone || "";
  const formattedPhone = formatPhone(phone);
  const formattedWhatsapp = formatPhone(whatsapp);

  const shortcuts = [
    {
      label: "Nome completo",
      emoji: "👤",
      action: () => onApply(clientData.client_name, ""),
      disabled: !clientData.client_name,
    },
    {
      label: "WhatsApp",
      emoji: "📱",
      action: () =>
        onApply(clientData.client_name, `📱 ${formattedWhatsapp}`),
      disabled: !whatsapp,
    },
    {
      label: "Telefone",
      emoji: "📞",
      action: () =>
        onApply(clientData.client_name, `📞 ${formattedPhone}`),
      disabled: !phone,
    },
    {
      label: "E-mail",
      emoji: "✉",
      action: () =>
        onApply(clientData.client_name, clientData.client_email || ""),
      disabled: !clientData.client_email,
    },
    {
      label: "Cidade/Estado",
      emoji: "📍",
      action: () =>
        onApply(
          clientData.client_name,
          [clientData.client_city, clientData.client_state]
            .filter(Boolean)
            .join(" - "),
        ),
      disabled: !clientData.client_name,
    },
  ];

  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-semibold">Atalhos Rápidos</Label>
      <p className="text-xs text-muted-foreground">
        Clique para preencher automaticamente com seus dados
      </p>

      <div className="flex flex-wrap gap-2">
        {shortcuts.map((shortcut) => (
          <Button
            key={shortcut.label}
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-colors"
            onClick={shortcut.action}
            disabled={shortcut.disabled}
          >
            <span>{shortcut.emoji}</span>
            {shortcut.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
