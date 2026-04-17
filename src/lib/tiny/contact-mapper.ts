/**
 * Mapeamento de contatos Tiny → colunas `clients` do CRM.
 * Usado pelo sync em lote e pela importação via webhook/API.
 */

export function cleanClientName(rawName: string): string {
  if (!rawName || typeof rawName !== "string") return rawName || "";
  return (
    rawName
      .replace(/^\d{2,3}\.?\d{3}\.?\d{3}\/?\d{0,4}-?\d{0,2}\s*/, "")
      .replace(/^\d{5,14}\s+/, "")
      .trim() || rawName
  );
}

function looksLikeCompany(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const upper = name.toUpperCase();
  return (
    /\b(LTDA|S\.?A\.?|S\/A|EIRELI|ME\b|EPP\b|E\.?P\.?)\b/.test(upper) ||
    upper.includes("CLINICA") ||
    upper.includes("ODONTOLOG")
  );
}

export function detectPersonType(contact: {
  tipoPessoa?: string;
  cpfCnpj?: string;
  cpf_cnpj?: string;
  nome?: string;
  nomeFantasia?: string;
  fantasia?: string;
}): "FISICA" | "JURIDICA" {
  if (["F", "E", "X"].includes(contact.tipoPessoa ?? "")) return "FISICA";
  if (contact.tipoPessoa === "J") {
    const doc = (contact.cpfCnpj || contact.cpf_cnpj || "").replace(/\D/g, "");
    const name = contact.nome ?? contact.nomeFantasia ?? contact.fantasia ?? "";
    if (doc.length === 0 && !looksLikeCompany(name)) return "FISICA";
    return "JURIDICA";
  }
  const doc = (contact.cpfCnpj || contact.cpf_cnpj || "").replace(/\D/g, "");
  if (doc.length === 11) return "FISICA";
  if (doc.length === 14) return "JURIDICA";
  return "FISICA";
}

/**
 * Monta o payload de upsert em `clients` a partir do objeto contato do Tiny
 * (formato retornado em listagens / pedidos).
 */
export function clientUpsertPayloadFromTinyContact(raw: Record<string, unknown>): {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  document: string | null;
  person_type: "FISICA" | "JURIDICA";
  city: string | null;
  state: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  tiny_id: number;
  tiny_synced_at: string;
} | null {
  const id = raw.id;
  const tinyId = typeof id === "number" ? id : typeof id === "string" ? Number(id) : NaN;
  if (!Number.isFinite(tinyId)) return null;

  const rawName = raw.nome ?? raw.nomeFantasia ?? raw.fantasia ?? "Sem nome";
  const endereco = (raw.endereco as Record<string, unknown>) ?? {};
  const city =
    (endereco.municipio as string | undefined) ??
    (endereco.cidade as string | undefined) ??
    (raw.municipio as string | undefined) ??
    (raw.cidade as string | undefined) ??
    null;

  return {
    name: cleanClientName(String(rawName)),
    email: (raw.email as string | undefined) ?? null,
    phone:
      (raw.telefone as string | undefined) ??
      (raw.fone as string | undefined) ??
      (raw.celular as string | undefined) ??
      (raw.telefoneComercial as string | undefined) ??
      null,
    company: (raw.nomeFantasia as string | undefined) ?? (raw.fantasia as string | undefined) ?? null,
    document: (raw.cpfCnpj as string | undefined) ?? (raw.cpf_cnpj as string | undefined) ?? null,
    person_type: detectPersonType({
      tipoPessoa: raw.tipoPessoa as string | undefined,
      cpfCnpj: raw.cpfCnpj as string | undefined,
      cpf_cnpj: raw.cpf_cnpj as string | undefined,
      nome: raw.nome as string | undefined,
      nomeFantasia: raw.nomeFantasia as string | undefined,
      fantasia: raw.fantasia as string | undefined,
    }),
    city,
    state: (endereco.uf as string | undefined) ?? (raw.uf as string | undefined) ?? null,
    zip_code: (endereco.cep as string | undefined) ?? (raw.cep as string | undefined) ?? null,
    street: (endereco.endereco as string | undefined) ?? (raw.endereco as string | undefined) ?? null,
    number: (endereco.numero as string | undefined) ?? (raw.numero as string | undefined) ?? null,
    complement: (endereco.complemento as string | undefined) ?? (raw.complemento as string | undefined) ?? null,
    neighborhood: (endereco.bairro as string | undefined) ?? (raw.bairro as string | undefined) ?? null,
    tiny_id: tinyId,
    tiny_synced_at: new Date().toISOString(),
  };
}
