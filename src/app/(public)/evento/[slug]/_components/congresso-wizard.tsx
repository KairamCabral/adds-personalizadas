"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatDocumentInput, isValidCPF, isValidCNPJ } from "@/lib/utils";
import { CONSENT_VERSION } from "@/lib/congressos/consent";
import type { Client } from "@/types/database.types";
import {
  findClientByDocument,
  registerParticipant,
  type RegisterPayload,
  type RegisterResult,
} from "@/services/congressos-public.service";
import { StepCpf } from "./step-cpf";
import { StepConfirm } from "./step-confirm";
import { StepRegister, type RegisterFormState } from "./step-register";
import { StepSuccess } from "./step-success";

type Step = "cpf" | "confirm" | "register" | "success";

interface Utm {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
}

interface CongressoWizardProps {
  slug: string;
  editionName: string;
  giftName: string | null;
  turnstileEnabled: boolean;
  utm: Utm;
}

const BLANK_FORM: RegisterFormState = {
  name: "",
  whatsapp: "",
  email: "",
  contactType: null,
};

export function CongressoWizard({
  slug,
  editionName,
  giftName,
  turnstileEnabled,
  utm,
}: CongressoWizardProps) {
  const storageKey = `congresso:${slug}`;

  const [step, setStep] = useState<Step>("cpf");
  const [documentValue, setDocumentValue] = useState("");
  const [foundClient, setFoundClient] = useState<Client | null>(null);
  const [form, setForm] = useState<RegisterFormState>(BLANK_FORM);
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [hadEmail, setHadEmail] = useState(false);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const retryRef = useRef<null | (() => void)>(null);
  const submittingRef = useRef(false);

  // Restaura rascunho (nunca perder o que foi digitado)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          documentValue?: string;
          form?: RegisterFormState;
          consent?: boolean;
        };
        if (saved.documentValue) setDocumentValue(saved.documentValue);
        if (saved.form) setForm({ ...BLANK_FORM, ...saved.form });
        if (saved.consent) setConsent(saved.consent);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave enquanto não concluiu
  useEffect(() => {
    if (step === "success") return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ documentValue, form, consent })
      );
    } catch {
      /* ignore */
    }
  }, [storageKey, documentValue, form, consent, step]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  // Retry automático ao reconectar (idempotency_key evita duplicar no servidor)
  useEffect(() => {
    const onOnline = () => {
      if (retryRef.current && !submittingRef.current) retryRef.current();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const goTo = (next: Step) => {
    setError(null);
    setStep(next);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLookup = async () => {
    const digits = documentValue.replace(/\D/g, "");
    if (digits.length === 11 && !isValidCPF(digits)) {
      setError("CPF inválido. Confira os números.");
      return;
    }
    if (digits.length === 14 && !isValidCNPJ(digits)) {
      setError("CNPJ inválido. Confira os números.");
      return;
    }
    setLookupLoading(true);
    setError(null);
    try {
      const client = await findClientByDocument(documentValue);
      if (client) {
        setFoundClient(client);
        goTo("confirm");
      } else {
        setFoundClient(null);
        goTo("register");
      }
    } catch {
      setError("Não foi possível verificar agora. Tente novamente.");
    } finally {
      setLookupLoading(false);
    }
  };

  const doSubmit = useCallback(
    async (payload: RegisterPayload, hasEmail: boolean) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await registerParticipant(payload);
        retryRef.current = null;
        setHadEmail(hasEmail);
        setResult(res);
        setStep("success");
        if (typeof window !== "undefined")
          window.scrollTo({ top: 0, behavior: "smooth" });
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Não foi possível concluir agora.";
        setError(
          navigator.onLine
            ? msg
            : "Sem conexão — vamos tentar de novo automaticamente. Seus dados estão salvos."
        );
        retryRef.current = () => {
          void doSubmit(payload, hasEmail);
        };
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [storageKey]
  );

  const handleConfirm = () => {
    if (!foundClient) return;
    doSubmit(
      {
        slug,
        document: documentValue,
        is_existing_client: true,
        existing_client_id: foundClient.id,
        contact_type: foundClient.sales_channel ?? null,
        consent: true,
        consent_version: CONSENT_VERSION,
        idempotency_key: idempotencyKey,
        turnstile_token: turnstileToken,
        utm_source: utm.source,
        utm_medium: utm.medium,
        utm_campaign: utm.campaign,
        utm_content: utm.content,
      },
      !!foundClient.email
    );
  };

  const handleRegister = () => {
    const email = form.email.trim() || null;
    doSubmit(
      {
        slug,
        document: documentValue,
        is_existing_client: false,
        name: form.name.trim(),
        phone: form.whatsapp.trim() || null,
        email,
        contact_type: form.contactType,
        consent: true,
        consent_version: CONSENT_VERSION,
        idempotency_key: idempotencyKey,
        turnstile_token: turnstileToken,
        utm_source: utm.source,
        utm_medium: utm.medium,
        utm_campaign: utm.campaign,
        utm_content: utm.content,
      },
      !!email
    );
  };

  return (
    <div className="py-4 sm:py-8">
      {step === "cpf" && (
        <StepCpf
          value={documentValue}
          onChange={(v) => setDocumentValue(formatDocumentInput(v))}
          onSubmit={handleLookup}
          loading={lookupLoading}
          error={error}
          editionName={editionName}
          giftName={giftName}
        />
      )}

      {step === "confirm" && foundClient && (
        <StepConfirm
          client={foundClient}
          consent={consent}
          onConsent={setConsent}
          onToken={setTurnstileToken}
          token={turnstileToken}
          turnstileEnabled={turnstileEnabled}
          onConfirm={handleConfirm}
          onBack={() => {
            setFoundClient(null);
            goTo("cpf");
          }}
          submitting={submitting}
          error={error}
        />
      )}

      {step === "register" && (
        <StepRegister
          form={form}
          onFormChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          consent={consent}
          onConsent={setConsent}
          onToken={setTurnstileToken}
          token={turnstileToken}
          turnstileEnabled={turnstileEnabled}
          onSubmit={handleRegister}
          onBack={() => goTo("cpf")}
          submitting={submitting}
          error={error}
        />
      )}

      {step === "success" && result && (
        <StepSuccess result={result} hasEmail={hadEmail} />
      )}
    </div>
  );
}
