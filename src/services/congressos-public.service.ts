import type { Client } from "@/types/database.types";

export interface RegisterPayload {
  slug: string;
  document: string;
  is_existing_client?: boolean;
  existing_client_id?: string | null;
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
export async function findClientByDocument(
  document: string
): Promise<Client | null> {
  const res = await fetch(
    `/api/clients/find-by-document?document=${encodeURIComponent(document)}`
  );
  const json = (await res.json().catch(() => ({}))) as { client?: Client | null };
  return json?.client ?? null;
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
