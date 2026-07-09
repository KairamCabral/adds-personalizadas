"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPhoneInput } from "@/lib/utils";
import { Loader2, ArrowLeft } from "lucide-react";
import { ConsentCheckbox } from "./consent-checkbox";
import { TurnstileWidget } from "./turnstile-widget";

export type ContactTypeChoice = "DENTISTA" | "DISTRIBUIDORA" | "CONSUMIDOR";

export interface RegisterFormState {
  name: string;
  whatsapp: string;
  email: string;
  contactType: ContactTypeChoice | null;
}

const CHIPS: { value: ContactTypeChoice; label: string }[] = [
  { value: "DENTISTA", label: "Dentista" },
  { value: "DISTRIBUIDORA", label: "Distribuidora" },
  { value: "CONSUMIDOR", label: "Outro" },
];

interface StepRegisterProps {
  form: RegisterFormState;
  onFormChange: (patch: Partial<RegisterFormState>) => void;
  consent: boolean;
  onConsent: (v: boolean) => void;
  onToken: (t: string | null) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}

export function StepRegister({
  form,
  onFormChange,
  consent,
  onConsent,
  onToken,
  onSubmit,
  onBack,
  submitting,
  error,
}: StepRegisterProps) {
  const whatsappDigits = form.whatsapp.replace(/\D/g, "");
  const canSubmit =
    form.name.trim().length >= 2 &&
    whatsappDigits.length >= 10 &&
    !!form.contactType &&
    consent;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Falta pouco!
        </h1>
        <p className="text-sm text-muted-foreground">
          Complete seus dados para retirar o brinde.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit && !submitting) onSubmit();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            autoFocus
            value={form.name}
            onChange={(e) => onFormChange({ name: e.target.value })}
            placeholder="Seu nome"
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp *</Label>
          <Input
            id="whatsapp"
            inputMode="numeric"
            value={form.whatsapp}
            onChange={(e) =>
              onFormChange({ whatsapp: formatPhoneInput(e.target.value) })
            }
            placeholder="(00) 00000-0000"
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => onFormChange({ email: e.target.value })}
            placeholder="email@exemplo.com (opcional)"
            className="h-12"
          />
        </div>

        <div className="space-y-2">
          <Label>Você é *</Label>
          <div className="grid grid-cols-3 gap-2">
            {CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => onFormChange({ contactType: chip.value })}
                className={cn(
                  "h-12 rounded-lg border text-sm font-medium transition-colors",
                  form.contactType === chip.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:bg-secondary/60"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <ConsentCheckbox checked={consent} onChange={onConsent} />
        <TurnstileWidget onToken={onToken} />

        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <div className="space-y-2">
          <Button
            type="submit"
            size="lg"
            className="h-14 w-full text-base"
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Concluindo...
              </>
            ) : (
              "Concluir e retirar brinde"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={onBack}
            disabled={submitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </form>
    </div>
  );
}
