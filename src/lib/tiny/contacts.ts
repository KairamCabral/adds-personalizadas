import { tinyApiGet, tinyApiPost, TinyTokenExpiredError } from "@/lib/tiny-api";
import {
  applySalesChannelToTinyContact,
  type SalesChannel,
} from "@/lib/sales-channel";
import { enqueueTinyRequest } from "./rate-limiter";

export interface TinyContactInput {
  name?: string | null;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  sales_channel?: SalesChannel | null;
  cidade?: string | null;
  uf?: string | null;
  endereco?: string | null;
  cep?: string | null;
}

export interface TinyContactResult {
  tiny_id: number | null;
  found: boolean;
}

/**
 * Cria ou localiza um contato no Tiny ERP (V3) com o Tipo de Contato correto.
 * Extraído de `src/app/api/tiny/create-contact/route.ts` para reuso no worker
 * de sync de congressos (todas as chamadas passam pelo throttle `enqueueTinyRequest`).
 *
 * NÃO checa conexão nem trata `TinyTokenExpiredError` — deixa propagar para o
 * chamador (o worker marca o job para retry/backoff).
 */
export async function createOrFindTinyContact(
  input: TinyContactInput
): Promise<TinyContactResult> {
  const docDigits = (input.document ?? "").replace(/\D/g, "");
  const phoneDigits = (input.phone ?? "").replace(/\D/g, "");
  const channel = input.sales_channel ?? null;

  let existingId: number | null = null;

  // Buscar por CPF/CNPJ primeiro
  if (docDigits.length >= 11) {
    try {
      const res = await enqueueTinyRequest(() =>
        tinyApiGet<{ itens?: { id: number }[] }>(
          `/contatos?limit=1&cpfCnpj=${encodeURIComponent(docDigits)}`
        )
      );
      const items = res?.itens ?? (res as any)?.data?.itens ?? [];
      if (items.length > 0 && items[0].id) existingId = items[0].id;
    } catch {
      // ignora erro de busca — segue para criação
    }
  }

  // Fallback: buscar por celular
  if (existingId == null && phoneDigits.length >= 10) {
    try {
      const res = await enqueueTinyRequest(() =>
        tinyApiGet<{ itens?: { id: number }[] }>(
          `/contatos?limit=1&celular=${encodeURIComponent(phoneDigits)}`
        )
      );
      const items = res?.itens ?? (res as any)?.data?.itens ?? [];
      if (items.length > 0 && items[0].id) existingId = items[0].id;
    } catch {
      // ignora
    }
  }

  if (existingId != null) return { tiny_id: existingId, found: true };

  // Criar novo contato
  const tipoPessoa = docDigits.length === 14 ? "J" : "F";
  const payload: Record<string, unknown> = {
    nome: (input.name ?? "").trim(),
    fantasia: (input.name ?? "").trim(),
    tipoPessoa,
  };
  if (docDigits) payload.cpfCnpj = docDigits;
  if (phoneDigits) {
    payload.telefone = phoneDigits;
    payload.celular = phoneDigits;
  }
  if (input.email) payload.email = input.email;
  if (input.endereco) payload.logradouro = input.endereco;
  if (input.cidade) payload.cidade = input.cidade;
  if (input.uf) payload.uf = input.uf;
  if (input.cep) payload.cep = input.cep.replace(/\D/g, "");

  // Anexa o canal (marcador `canal:<X>` + "tipo de contato" best-effort).
  // ⚠️ Formato do campo `tipos` na V3 não validado — por isso retry sem-canal.
  const payloadWithChannel = applySalesChannelToTinyContact(payload, channel);

  let created: Record<string, unknown>;
  try {
    created = await enqueueTinyRequest(() =>
      tinyApiPost<Record<string, unknown>>("/contatos", payloadWithChannel)
    );
  } catch (err) {
    if (channel && !(err instanceof TinyTokenExpiredError)) {
      console.warn(
        "[tiny/contacts] Falha com canal — retry sem canal:",
        err instanceof Error ? err.message : err
      );
      created = await enqueueTinyRequest(() =>
        tinyApiPost<Record<string, unknown>>("/contatos", payload)
      );
    } else {
      throw err;
    }
  }

  const newId =
    (created as any)?.id ??
    (created as any)?.data?.id ??
    (created as any)?.retorno?.registros?.[0]?.registro?.id ??
    (created as any)?.registros?.[0]?.id;

  return { tiny_id: newId ? Number(newId) : null, found: false };
}
