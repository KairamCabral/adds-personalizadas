/**
 * Sincronização incremental de contatos Tiny → CRM
 *
 * Estratégia por offset persistido:
 * - Processa N páginas (500 contatos) por execução
 * - Avança o cursor (offset) a cada run
 * - Ao chegar ao fim (página vazia ou incompleta), reseta para 0
 * - Assim cobre todos os contatos em ciclo, incluindo novos
 *
 * Otimização: na 1ª página (offset 0), tenta ordenar=id&ordem=desc.
 * Se a API retornar os mais recentes primeiro, faz early exit quando
 * todos já forem conhecidos (id <= max_tiny_id do CRM).
 */

import { createClient } from "@supabase/supabase-js";
import { tinyApiGet } from "@/lib/tiny-api";

const LOG_PREFIX = "[Tiny Sync Incremental]";
const SETTINGS_KEY = "tiny_clients_incremental_sync";
const PAGES_PER_RUN = 5;
const LIMIT = 100;

export type IncrementalSyncResult = {
  success: boolean;
  synced: number;
  pagesProcessed: number;
  earlyExit: boolean;
  nextOffset: number;
  message: string;
};

function cleanClientName(rawName: string): string {
  if (!rawName || typeof rawName !== "string") return rawName || "";
  return (
    rawName
      .replace(
        /^\d{2,3}\.?\d{3}\.?\d{3}\/?\d{0,4}-?\d{0,2}\s*/,
        ""
      )
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

function detectPersonType(contact: any): "FISICA" | "JURIDICA" {
  if (["F", "E", "X"].includes(contact.tipoPessoa)) return "FISICA";
  if (contact.tipoPessoa === "J") {
    const doc = (contact.cpfCnpj || contact.cpf_cnpj || "")
      .replace(/\D/g, "");
    const name = contact.nome ?? contact.nomeFantasia ?? contact.fantasia ?? "";
    if (doc.length === 0 && !looksLikeCompany(name)) return "FISICA";
    return "JURIDICA";
  }
  const doc = (contact.cpfCnpj || contact.cpf_cnpj || "")
    .replace(/\D/g, "");
  if (doc.length === 11) return "FISICA";
  if (doc.length === 14) return "JURIDICA";
  return "FISICA";
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function parseTinyId(raw: any): number | null {
  const id = raw?.id ?? raw?.contato?.id;
  if (id == null) return null;
  const n = typeof id === "string" ? parseInt(id, 10) : Number(id);
  return Number.isFinite(n) ? n : null;
}

function buildEndpoint(offset: number, useOrderDesc: boolean): string {
  const params = new URLSearchParams({
    limit: String(LIMIT),
    offset: String(offset),
  });
  if (useOrderDesc) {
    params.set("ordenar", "id");
    params.set("ordem", "desc");
  }
  return `/contatos?${params.toString()}`;
}

export function mapContactToClient(raw: any) {
  const endereco = raw.endereco ?? {};
  const rawName = raw.nome ?? raw.nomeFantasia ?? raw.fantasia ?? "Sem nome";
  const city =
    endereco.municipio ??
    endereco.cidade ??
    raw.municipio ??
    raw.cidade ??
    null;
  return {
    name: cleanClientName(rawName),
    email: raw.email ?? null,
    phone:
      raw.telefone ??
      raw.fone ??
      raw.celular ??
      raw.telefoneComercial ??
      null,
    company: raw.nomeFantasia ?? raw.fantasia ?? null,
    document: raw.cpfCnpj ?? raw.cpf_cnpj ?? null,
    person_type: detectPersonType(raw),
    city,
    state: endereco.uf ?? raw.uf ?? null,
    zip_code: endereco.cep ?? raw.cep ?? null,
    street: endereco.endereco ?? raw.endereco ?? null,
    number: endereco.numero ?? raw.numero ?? null,
    complement: endereco.complemento ?? raw.complemento ?? null,
    neighborhood: endereco.bairro ?? raw.bairro ?? null,
    tiny_id: raw.id,
    tiny_synced_at: new Date().toISOString(),
  };
}

export async function runIncrementalClientsSync(): Promise<IncrementalSyncResult> {
  const supabase = getServiceClient();

  const { data: settingsRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .single();

  const settings = (settingsRow?.value as Record<string, unknown>) ?? {};
  let offset = typeof settings.last_offset === "number" ? settings.last_offset : 0;
  const useOrderDesc = offset === 0;

  const { data: maxRow } = await supabase
    .from("clients")
    .select("tiny_id")
    .not("tiny_id", "is", null)
    .order("tiny_id", { ascending: false })
    .limit(1)
    .single();

  const maxTinyId = maxRow?.tiny_id != null ? Number(maxRow.tiny_id) : 0;
  console.log(`${LOG_PREFIX} offset=${offset}, max_tiny_id=${maxTinyId}`);

  let synced = 0;
  let pagesProcessed = 0;
  let earlyExit = false;
  let nextOffset = offset;

  for (let i = 0; i < PAGES_PER_RUN; i++) {
    const endpoint = buildEndpoint(offset, useOrderDesc && i === 0);
    console.log(`${LOG_PREFIX} Chamando: ${endpoint}`);

    const response = await tinyApiGet(endpoint);
    const contacts =
      (response as any)?.itens ??
      (response as any)?.data?.itens ??
      (response as any)?.contatos ??
    [];

    if (!Array.isArray(contacts)) {
      throw new Error(
        `Formato inesperado da API Tiny. Resposta: ${JSON.stringify(response).slice(0, 500)}`
      );
    }

    pagesProcessed++;

    if (contacts.length === 0) {
      nextOffset = 0;
      console.log(`${LOG_PREFIX} Página vazia, resetando offset para 0`);
      break;
    }

    let allKnown = true;
    for (const contact of contacts) {
      const raw = contact.contato ?? contact;
      const tinyId = parseTinyId(raw);
      if (tinyId == null) continue;

      if (useOrderDesc && tinyId <= maxTinyId) continue;
      allKnown = false;

      const clientData = mapContactToClient(raw);

      const { error } = await supabase
        .from("clients")
        .upsert(clientData as any, { onConflict: "tiny_id" });

      if (!error) synced++;

      await supabase.from("tiny_sync_logs").insert({
        entity_type: "client",
        tiny_id: raw.id,
        direction: "tiny_to_crm",
        status: error ? "error" : "success",
        error_message: error?.message ?? null,
      });
    }

    if (useOrderDesc && allKnown && contacts.length > 0) {
      earlyExit = true;
      nextOffset = 0;
      console.log(
        `${LOG_PREFIX} Early exit: todos os ${contacts.length} já conhecidos (id <= ${maxTinyId})`
      );
      break;
    }

    nextOffset = offset + contacts.length;
    offset = nextOffset;

    if (contacts.length < LIMIT) {
      nextOffset = 0;
      console.log(`${LOG_PREFIX} Última página incompleta, resetando offset`);
      break;
    }

    if (useOrderDesc) {
      nextOffset = 0;
      console.log(
        `${LOG_PREFIX} Ordem DESC: 1 página processada, próximo run inicia do offset 0 (ordem padrão)`
      );
      break;
    }
  }

  const lastRun = {
    last_run: new Date().toISOString(),
    last_offset: nextOffset,
    max_tiny_id: maxTinyId,
    synced_this_run: synced,
    early_exit: earlyExit,
  };

  await supabase.from("app_settings").upsert({
    key: SETTINGS_KEY,
    value: lastRun,
    updated_at: new Date().toISOString(),
  });

  console.log(
    `${LOG_PREFIX} Concluído: ${synced} sincronizados, ${pagesProcessed} páginas, earlyExit=${earlyExit}, nextOffset=${nextOffset}`
  );

  return {
    success: true,
    synced,
    pagesProcessed,
    earlyExit,
    nextOffset,
    message: `${synced} contatos sincronizados incrementalmente.`,
  };
}
