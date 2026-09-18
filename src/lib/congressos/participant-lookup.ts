/**
 * "Já tenho cadastro?" do wizard público do congresso — tipos e funções puras.
 *
 * A consulta procura o CPF no CRM e, se não achar, no Tiny. O que volta para o
 * navegador é deliberadamente MÍNIMO: a rota é pública, e qualquer um pode
 * digitar o CPF de outra pessoa. Nada de e-mail, telefone ou endereço crus —
 * só o suficiente para a pessoa reconhecer o próprio cadastro.
 *
 * Sem React, sem I/O: testável. A parte que fala com banco e Tiny está em
 * `participant-lookup.server.ts`.
 */
import { onlyDigits, validateBrMobile } from "./phone-br";
import type { SalesChannel } from "@/lib/sales-channel";

export type ParticipantSource = "crm" | "tiny";

/** Resposta pública da consulta — nunca contém dado de contato cru. */
export type ParticipantLookupResponse =
  | {
      found: true;
      source: ParticipantSource;
      /** id opaco (cliente do CRM ou contato do Tiny) para o confirm */
      ref: string;
      name: string | null;
      maskedEmail: string | null;
      /** só quando o cadastro tem celular válido */
      maskedPhone: string | null;
      /** false → o wizard pede o WhatsApp antes de confirmar */
      phoneValid: boolean;
      /** null → o wizard pergunta se é dentista, distribuidora… */
      contactType: SalesChannel | null;
    }
  | { found: false };

/** "co••••••@gmail.com". Sem "@" não dá para mascarar com segurança → null. */
export function maskEmail(email: string | null | undefined): string | null {
  const value = (email ?? "").trim();
  const at = value.lastIndexOf("@");
  if (at < 1 || at === value.length - 1) return null;
  const user = value.slice(0, at);
  const domain = value.slice(at + 1);
  return `${user.slice(0, 2)}${"•".repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

/** "(48) •••••-8070" — DDD e últimos 4, o bastante para reconhecer. */
export function maskPhoneBr(phone: string | null | undefined): string | null {
  const res = validateBrMobile(phone);
  if (!res.ok) return null;
  return `(${res.digits.slice(0, 2)}) •••••-${res.digits.slice(-4)}`;
}

/**
 * Primeiro celular válido entre os candidatos, já só com dígitos.
 * O Tiny guarda o número em campos diferentes (celular, telefone, fone…) e o
 * mapper compartilhado prioriza `telefone`, que costuma ser fixo — para
 * mandar código no WhatsApp, só celular serve.
 */
export function pickMobile(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const c of candidates) {
    const res = validateBrMobile(c);
    if (res.ok) return res.digits;
  }
  return null;
}

/** Mesmo documento, comparando só dígitos. Vazio nunca bate. */
export function sameDocument(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const da = onlyDigits(a);
  return da.length > 0 && da === onlyDigits(b);
}
