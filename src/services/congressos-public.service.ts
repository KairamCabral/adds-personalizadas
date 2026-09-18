import type { ParticipantLookupResponse } from "@/lib/congressos/participant-lookup";

export interface RegisterPayload {
  slug: string;
  document: string;
  is_existing_client?: boolean;
  existing_client_id?: string | null;
  /** cadastro confirmado no passo "Encontramos seu cadastro" */
  existing_source?: "crm" | "tiny" | null;
  existing_ref?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_type?: "CONSUMIDOR" | "DENTISTA" | "DISTRIBUIDORA" | "VAREJISTA" | null;
  consent: true;
  consent_version: string;
  idempotency_key: string;
  turnstile_token?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
}

export interface RegisterResult {
  token: string;
  short_code: string;
  gift_name: string | null;
  participant_first_name: string | null;
  raffle_number: number | null;
  /** frase type-aware do benefício (desconto/vale-compras) — null se não elegível */
  cashback_label: string | null;
  alreadyRegistered: boolean;
}

/** Passo do CPF — reusa o endpoint público existente. Retorna o cliente ou null. */
/**
 * "Já tenho cadastro?" — procura o CPF no CRM e, se não achar, no Tiny.
 * Devolve só dados mascarados. Qualquer falha vira "não achou": o wizard segue
 * para o cadastro manual, nunca trava a inscrição.
 */
export async function lookupParticipant(
  slug: string,
  document: string
): Promise<ParticipantLookupResponse> {
  try {
    const params = new URLSearchParams({ slug, document });
    const res = await fetch(`/api/congressos/lookup?${params.toString()}`);
    if (!res.ok) return { found: false };
    return (await res.json()) as ParticipantLookupResponse;
  } catch {
    return { found: false };
  }
}

/** Submete o pré-cadastro público. Lança em erro para o retry do wizard tratar. */
export async function registerParticipant(
  payload: RegisterPayload
): Promise<RegisterResult> {
  const res = await fetch("/api/congressos/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as
    | RegisterResult
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      ("error" in json && json.error) || "Erro ao concluir o pré-cadastro."
    );
  }
  return json as RegisterResult;
}
