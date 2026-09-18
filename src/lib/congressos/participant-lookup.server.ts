/**
 * "Já tenho cadastro?" do congresso — lado servidor (CRM + Tiny).
 *
 * Server-only: fala com o banco pelo admin client e com a API do Tiny. Nunca
 * importar em client component.
 *
 * Por que consultar o Tiny: o cron `tiny-sync-incremental` leva contatos
 * Tiny → CRM em lotes de 500 por dia útil, e o Tiny tem 15 mil+. Quem só existe
 * no Tiny não era encontrado e tinha de redigitar tudo.
 *
 * Regras que não podem ser quebradas:
 *  - Só LEITURA no Tiny. A escrita de contato continua sendo do worker de sync.
 *  - Falha ABERTA: Tiny fora do ar, lento ou com token expirado → "não achou",
 *    e o wizard cai no formulário manual. O Tiny nunca bloqueia inscrição.
 *  - O CPF do cadastro encontrado TEM que bater com o digitado.
 */
import { tinyApiGet } from "@/lib/tiny-api";
import { enqueueTinyRequest } from "@/lib/tiny/rate-limiter";
import { findTinyContactIdByDocument } from "@/lib/tiny/contacts";
import { mapContactToClient } from "@/lib/tiny-sync-incremental";
import type { SalesChannel } from "@/lib/sales-channel";
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  maskEmail,
  maskPhoneBr,
  pickMobile,
  sameDocument,
  type ParticipantLookupResponse,
  type ParticipantSource,
} from "./participant-lookup";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Tempo máximo esperando o Tiny antes de desistir e seguir sem ele. */
export const TINY_LOOKUP_TIMEOUT_MS = 4000;

/** Dados completos do cadastro encontrado — só circulam no servidor. */
export interface ResolvedParticipant {
  source: ParticipantSource;
  ref: string;
  /** id do cliente no CRM; null quando veio só do Tiny */
  clientId: string | null;
  name: string | null;
  email: string | null;
  /** celular válido (só dígitos) ou null */
  mobile: string | null;
  salesChannel: SalesChannel | null;
}

interface ClientRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  document: string | null;
  sales_channel: SalesChannel | null;
}

function fromClient(c: ClientRow): ResolvedParticipant {
  return {
    source: "crm",
    ref: c.id,
    clientId: c.id,
    name: c.name,
    email: c.email,
    mobile: pickMobile(c.phone),
    salesChannel: c.sales_channel ?? null,
  };
}

/** Resolve a promessa ou devolve null — qualquer erro, ou estourou o tempo. */
async function orNullWithin<T>(
  work: Promise<T | null>,
  ms: number
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([work.catch(() => null), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Lê o contato do Tiny e só o aceita se o CPF bater com `expectedDigits`.
 * Também é o que a rota de cadastro usa para revalidar o `ref` recebido do
 * navegador — nunca confiar no que veio de uma rota pública.
 */
async function fetchTinyParticipant(
  ref: string,
  expectedDigits: string
): Promise<ResolvedParticipant | null> {
  if (!/^\d+$/.test(ref)) return null;
  const res = await enqueueTinyRequest(() =>
    tinyApiGet<unknown>(`/contatos/${ref}`)
  );
  const raw = ((res as { data?: unknown })?.data ?? res) as Record<
    string,
    unknown
  > | null;
  if (!raw || typeof raw !== "object") return null;

  const mapped = mapContactToClient(raw);
  if (!sameDocument(mapped.document, expectedDigits)) return null;

  return {
    source: "tiny",
    ref: String(raw.id ?? ref),
    clientId: null,
    name: mapped.name ?? null,
    email: mapped.email ?? null,
    // celular primeiro: o mapper compartilhado prioriza `telefone` (fixo).
    mobile: pickMobile(
      raw.celular as string | undefined,
      raw.telefone as string | undefined,
      raw.fone as string | undefined,
      raw.telefoneComercial as string | undefined
    ),
    salesChannel:
      (mapped as { sales_channel?: SalesChannel }).sales_channel ?? null,
  };
}

async function findTinyByCpf(
  digits: string
): Promise<ResolvedParticipant | null> {
  const id = await findTinyContactIdByDocument(digits);
  if (id == null) return null;
  return fetchTinyParticipant(String(id), digits);
}

/** CPF (só dígitos) → cadastro no CRM, senão no Tiny, senão null. */
export async function findParticipantByCpf(
  admin: AdminClient,
  digits: string,
  tinyTimeoutMs = TINY_LOOKUP_TIMEOUT_MS
): Promise<ResolvedParticipant | null> {
  const { data } = await admin.rpc("find_client_by_document", {
    doc_digits: digits,
  });
  const client = (Array.isArray(data) ? data[0] : null) as ClientRow | null;
  if (client) return fromClient(client);

  return orNullWithin(findTinyByCpf(digits), tinyTimeoutMs);
}

/**
 * Revalida, no cadastro, o contato do Tiny que o participante confirmou.
 * Devolve null se o `ref` não existir, se o CPF dele não for o digitado, ou se
 * o Tiny falhar — sem essa conferência, bastaria mandar o CPF de uma pessoa
 * com o id de outra para herdar nome, e-mail e telefone dela.
 */
export async function resolveConfirmedTinyParticipant(
  ref: string,
  digits: string,
  tinyTimeoutMs = TINY_LOOKUP_TIMEOUT_MS
): Promise<ResolvedParticipant | null> {
  return orNullWithin(fetchTinyParticipant(ref, digits), tinyTimeoutMs);
}

/** O que a rota pública pode devolver: só o mascarado. */
export function toPublicLookup(
  p: ResolvedParticipant | null
): ParticipantLookupResponse {
  if (!p) return { found: false };
  return {
    found: true,
    source: p.source,
    ref: p.ref,
    name: p.name,
    maskedEmail: maskEmail(p.email),
    maskedPhone: maskPhoneBr(p.mobile),
    phoneValid: p.mobile != null,
    contactType: p.salesChannel,
  };
}
