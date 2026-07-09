"use client";

import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { maskPhone } from "@/lib/utils";
import type { Client } from "@/types/database.types";
import { ConsentCheckbox } from "./consent-checkbox";
import { TurnstileWidget } from "./turnstile-widget";

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const head = user.slice(0, 2);
  return `${head}${"•".repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

interface StepConfirmProps {
  client: Client;
  consent: boolean;
  onConsent: (v: boolean) => void;
  onToken: (t: string | null) => void;
  onConfirm: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}

export function StepConfirm({
  client,
  consent,
  onConsent,
  onToken,
  onConfirm,
  onBack,
  submitting,
  error,
}: StepConfirmProps) {
  const firstName = (client.name ?? "").split(" ")[0] || "tudo bem";

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Olá, {firstName}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Encontramos seu cadastro. Confirme para retirar o brinde.
        </p>
      </div>

      <div className="space-y-1 rounded-lg border bg-card p-4 text-sm">
        <p className="font-medium">{client.name}</p>
        {maskEmail(client.email) && (
          <p className="text-muted-foreground">{maskEmail(client.email)}</p>
        )}
        {client.phone && (
          <p className="text-muted-foreground">{maskPhone(client.phone)}</p>
        )}
      </div>

      <ConsentCheckbox checked={consent} onChange={onConsent} />
      <TurnstileWidget onToken={onToken} />

      {error && <p className="text-center text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        <Button
          size="lg"
          className="h-14 w-full text-base"
          disabled={!consent || submitting}
          onClick={onConfirm}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Liberando...
            </>
          ) : (
            "Sim, é isso — retirar brinde"
          )}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={onBack}
          disabled={submitting}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Não sou eu / corrigir
        </Button>
      </div>
    </div>
  );
}
