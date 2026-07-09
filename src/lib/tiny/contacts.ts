import { tinyApiGet, tinyApiPost, TinyTokenExpiredError } from "@/lib/tiny-api";
import {
  applySalesChannelToTinyContact,
  type SalesChannel,
} from "@/lib/sales-channel";
import { maskCPF, maskCNPJ } from "@/lib/utils";
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

/** Extrai o id de um item de contato do Tiny, tolerando os vários formatos da V3. */
function extractContactId(res: unknown): number | null {
  const r = res as any;
  const items =
    r?.itens ?? r?.data?.itens ?? r?.contatos ?? r?.data?.contatos ?? [];
  const first = Array.isArray(items) ? items[0] : null;
  const id = first?.id ?? first?.contato?.id;
  return id ? Number(id) : null;
}

/** Uma busca isolada por um parâmetro (cpfCnpj/celular). Erros são engolidos (retorna null). */
async function searchByParam(
  param: "cpfCnpj" | "celular",
  value: string
): Promise<number | null> {
  if (!value) return null;
  try {
    const res = await enqueueTinyRequest(() =>
      tinyApiGet<unknown>(
        `/contatos?limit=1&${param}=${encodeURIComponent(value)}`
      )
    );
    return extractContactId(res);
  } catch {
    return null;
  }
}

/**
 * Busca o contato tentando o documento em DÍGITOS e FORMATADO (a V3 aceita/indexa
 * de formas diferentes conforme o cadastro), e por fim por celular.
 */
async function searchTinyContact(
  docDigits: string,
  phoneDigits: string
): Promise<number | null> {
  const docCandidates: string[] = [];
  if (docDigits.length === 11) {
    docCandidates.push(docDigits, maskCPF(docDigits));
  } else if (docDigits.length === 14) {
    docCandidates.push(docDigits, maskCNPJ(docDigits));
  } else if (docDigits.length >= 11) {
    docCandidates.push(docDigits);
  }

  for (const cand of docCandidates) {
    const id = await searchByParam("cpfCnpj", cand);
    if (id != null) return id;
  }

  if (phoneDigits.length >= 10) {
    const id = await searchByParam("celular", phoneDigits);
    if (id != null) return id;
  }

  return null;
}

/** Detecta o 400 recuperável "Contato com CPF/CNPJ ... já existe" do Tiny. */
function isAlreadyExistsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("já existe") ||
    m.includes("ja existe") ||
    m.includes("already exists")
  );
}

/**
 * Cria ou localiza um contato no Tiny ERP (V3) com o Tipo de Contato correto.
 * Extraído de `src/app/api/tiny/create-contact/route.ts` para reuso no worker
 * de sync de congressos (todas as chamadas passam pelo throttle `enqueueTinyRequest`).
 *
 * RESILIÊNCIA: a V3 pode retornar 400 "já existe" mesmo quando a busca prévia
 * não encontrou o contato (formato do documento). Nesse caso, refaz a busca
 * (dígitos + formatado) e usa o id encontrado — o erro determinístico nunca
 * esgota as retentativas do worker.
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

  // 1) Busca prévia (dígitos + formatado + celular)
  const preExisting = await searchTinyContact(docDigits, phoneDigits);
  if (preExisting != null) return { tiny_id: preExisting, found: true };

  // 2) Criação
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

  const postOnce = (body: Record<string, unknown>) =>
    enqueueTinyRequest(() =>
      tinyApiPost<Record<string, unknown>>("/contatos", body)
    );

  // Em qualquer POST, "já existe" é recuperável: refaz a busca e usa o id.
  const recoverAlreadyExists = async (
    err: unknown
  ): Promise<TinyContactResult> => {
    const found = await searchTinyContact(docDigits, phoneDigits);
    if (found != null) return { tiny_id: found, found: true };
    throw err instanceof Error ? err : new Error(String(err));
  };

  let created: Record<string, unknown>;
  try {
    created = await postOnce(payloadWithChannel);
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      return recoverAlreadyExists(err);
    }
    if (channel && !(err instanceof TinyTokenExpiredError)) {
      console.warn(
        "[tiny/contacts] Falha com canal — retry sem canal:",
        err instanceof Error ? err.message : err
      );
      try {
        created = await postOnce(payload);
      } catch (err2) {
        if (isAlreadyExistsError(err2)) return recoverAlreadyExists(err2);
        throw err2;
      }
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
