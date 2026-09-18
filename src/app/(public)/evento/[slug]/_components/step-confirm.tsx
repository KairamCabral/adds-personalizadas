"use client";

import { useState } from "react";
import { Loader2, ArrowLeft, Check, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatPhoneInput } from "@/lib/utils";
import { phoneIssueMessage, validateBrMobile } from "@/lib/congressos/phone-br";
import type { ParticipantLookupResponse } from "@/lib/congressos/participant-lookup";
import { ConsentCheckbox } from "./consent-checkbox";
import { TurnstileWidget, TURNSTILE_ENABLED } from "./turnstile-widget";
import { CONTACT_TYPE_CHIPS, type ContactTypeChoice } from "./step-register";

export type FoundParticipant = Extract<ParticipantLookupResponse, { found: true }>;

/** "keep" = mantém o celular do cadastro; "change" = digita outro. */
export type PhoneMode = "keep" | "change";

interface StepConfirmProps {
  participant: FoundParticipant;
  phoneMode: PhoneMode;
  onPhoneMode: (m: PhoneMode) => void;
  phone: string;
  onPhone: (v: string) => void;
  /** Perfil escolhido aqui — só é perguntado quando o cadastro não traz. */
  contactType: ContactTypeChoice | null;
  onContactType: (v: ContactTypeChoice) => void;
  consent: boolean;
  onConsent: (v: boolean) => void;
  onToken: (t: string | null) => void;
  token: string | null;
  turnstileEnabled: boolean;
  onConfirm: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}

/**
 * Confirmação de quem já tem cadastro (no CRM ou no Tiny).
 *
 * O telefone aparece mascarado e a pessoa confirma se ainda é o WhatsApp dela.
 * É esse número que ela vai informar no estande — se o do cadastro estiver
 * desatualizado, a busca por telefone no balcão não a encontra.
 */
export function StepConfirm({
  participant,
  phoneMode,
  onPhoneMode,
  phone,
  onPhone,
  contactType,
  onContactType,
  consent,
  onConsent,
  onToken,
  token,
  turnstileEnabled,
  onConfirm,
  onBack,
  submitting,
  error,
}: StepConfirmProps) {
  const [phoneTouched, setPhoneTouched] = useState(false);

  const firstName = (participant.name ?? "").split(" ")[0] || "tudo bem";

  // Sem celular válido no cadastro (vazio, fixo ou falso), o campo é obrigatório.
  const pedeTelefone = !participant.phoneValid || phoneMode === "change";
  const phoneCheck = validateBrMobile(phone);
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneError =
    pedeTelefone &&
    !phoneCheck.ok &&
    (phoneTouched || phoneDigits.length >= 11)
      ? phoneIssueMessage(phoneCheck.reason)
      : null;

  const pedePerfil = !participant.contactType;

  // Turnstile exige o token só quando configurado (env) E habilitado na edição
  // (break-glass). Fica fail-open quando ausente ou desligado na edição.
  const turnstileActive = TURNSTILE_ENABLED && turnstileEnabled;
  const awaitingToken = turnstileActive && !token;
  const canConfirm =
    consent &&
    !awaitingToken &&
    (!pedeTelefone || phoneCheck.ok) &&
    (!pedePerfil || !!contactType);

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
        <p className="font-medium">{participant.name}</p>
        {participant.maskedEmail && (
          <p className="text-muted-foreground">{participant.maskedEmail}</p>
        )}
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        {participant.phoneValid && participant.maskedPhone ? (
          <>
            <p className="text-sm font-medium">Esse ainda é seu WhatsApp?</p>
            <p className="flex items-center gap-2 text-lg font-semibold tabular-nums">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {participant.maskedPhone}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onPhoneMode("keep")}
                className={cn(
                  "flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors",
                  phoneMode === "keep"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:bg-secondary/60"
                )}
              >
                {phoneMode === "keep" && <Check className="h-4 w-4" />}
                Sim, é esse
              </button>
              <button
                type="button"
                onClick={() => onPhoneMode("change")}
                className={cn(
                  "h-11 rounded-lg border text-sm font-medium transition-colors",
                  phoneMode === "change"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:bg-secondary/60"
                )}
              >
                Trocar número
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm font-medium">
            Precisamos do seu WhatsApp para a retirada.
          </p>
        )}

        {pedeTelefone && (
          <div className="space-y-2">
            <Label htmlFor="confirm-whatsapp">
              {participant.phoneValid ? "Novo WhatsApp *" : "WhatsApp *"}
            </Label>
            <Input
              id="confirm-whatsapp"
              inputMode="numeric"
              value={phone}
              onChange={(e) => onPhone(formatPhoneInput(e.target.value))}
              onBlur={() => setPhoneTouched(true)}
              placeholder="(00) 00000-0000"
              className={cn("h-12", phoneError && "border-destructive")}
              aria-invalid={!!phoneError}
              aria-describedby={phoneError ? "confirm-whatsapp-erro" : undefined}
            />
            {phoneError && (
              <p id="confirm-whatsapp-erro" className="text-sm text-destructive">
                {phoneError}
              </p>
            )}
          </div>
        )}
      </div>

      {pedePerfil && (
        <div className="space-y-2">
          <Label>Você é *</Label>
          <div className="grid grid-cols-3 gap-2">
            {CONTACT_TYPE_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => onContactType(chip.value)}
                className={cn(
                  "h-12 rounded-lg border text-sm font-medium transition-colors",
                  contactType === chip.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:bg-secondary/60"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <ConsentCheckbox checked={consent} onChange={onConsent} />
      {turnstileActive && <TurnstileWidget onToken={onToken} />}

      {error && <p className="text-center text-sm text-destructive">{error}</p>}
      {consent && awaitingToken && (
        <p className="text-center text-xs text-muted-foreground">
          Verificando segurança, aguarde um instante…
        </p>
      )}

      <div className="space-y-2">
        <Button
          size="lg"
          className="h-14 w-full text-base"
          disabled={!canConfirm || submitting}
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
