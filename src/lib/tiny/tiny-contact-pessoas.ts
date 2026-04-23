import { tinyApiGet, TinyTokenExpiredError } from "@/lib/tiny-api";

// Tiny v3: array "contatos" | legado "pessoasContato". Telefone: "telefone" | "fone"
export interface TinyContactPerson {
  id?: number | null;
  nome?: string | null;
  setor?: string | null;
  email?: string | null;
  telefone?: string | null;
  fone?: string | null;
  ramal?: string | null;
}

export interface TinyContactDetail {
  id?: number;
  nome?: string;
  contatos?: TinyContactPerson[];
  pessoasContato?: TinyContactPerson[];
}

export function extractContact(raw: unknown): TinyContactDetail {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  return (r.data as TinyContactDetail) ?? (r.contato as TinyContactDetail) ?? (raw as TinyContactDetail);
}

export function extractContactPersons(contact: TinyContactDetail): TinyContactPerson[] {
  return contact.contatos ?? contact.pessoasContato ?? [];
}

/**
 * Primeira pessoa de contato útil para o card "Contato do chat" do pipeline.
 * Ordem: mesma do Tiny. Prioriza quem tiver nome + telefone; senão, primeiro com nome.
 */
export function pickPessoaContatoForChat(
  pessoas: TinyContactPerson[]
): { nome: string; telefone: string } | null {
  if (!pessoas.length) return null;

  for (const p of pessoas) {
    const nome = (p.nome ?? "").trim();
    if (!nome) continue;
    const tel = (p.telefone ?? p.fone ?? "").trim();
    if (tel) {
      return { nome, telefone: tel };
    }
  }

  const first = pessoas[0];
  const nome = (first.nome ?? "").trim();
  if (nome) {
    return { nome, telefone: (first.telefone ?? first.fone ?? "").trim() };
  }

  return null;
}

/**
 * GET /contatos/{id} no Tiny e retorna a primeira pessoa de contato para o CRM.
 * Usado na importação de pedido (novo) para preencher contact_name / contact_phone.
 */
export async function fetchFirstPessoaContatoForChat(
  tinyClientId: number
): Promise<{ nome: string; telefone: string } | null> {
  if (!Number.isFinite(tinyClientId)) return null;
  let raw: unknown;
  try {
    raw = await tinyApiGet(`/contatos/${tinyClientId}`);
  } catch (e) {
    if (e instanceof TinyTokenExpiredError) {
      console.info("[fetchFirstPessoaContatoForChat] Tiny desconectado, sem contato do chat");
    } else {
      console.info("[fetchFirstPessoaContatoForChat] GET contato:", e);
    }
    return null;
  }
  const contact = extractContact(raw);
  const pessoas = extractContactPersons(contact);
  return pickPessoaContatoForChat(pessoas);
}
