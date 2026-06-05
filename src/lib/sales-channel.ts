/**
 * Canal de venda (`clients.sales_channel` / `orders.sales_channel`).
 *
 * Fonte única de verdade pra: derivar o canal a partir de texto, rotular em
 * pt-BR e fazer a ponte com o Tiny ERP, onde o canal é representado pelo
 * "tipo de contato" do contato.
 *
 * ⚠️ Compartilhado com o adds-rep-app via mesmo banco: `channelFromSegment`
 * espelha a regra de `adds-rep-app/lib/pricing.ts`. Manter as duas em sincronia.
 */

import type { Database } from "@/types/database.types";

export type SalesChannel = Database["public"]["Enums"]["sales_channel"];

export const SALES_CHANNEL_VALUES = [
  "CONSUMIDOR",
  "DENTISTA",
  "DISTRIBUIDORA",
  "VAREJISTA",
] as const;

/** Rótulos pt-BR pra UI (Select, Badge). */
export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  CONSUMIDOR: "Consumidor",
  DENTISTA: "Dentista",
  DISTRIBUIDORA: "Distribuidora",
  VAREJISTA: "Varejista",
};

function isSalesChannel(value: string): value is SalesChannel {
  return (SALES_CHANNEL_VALUES as readonly string[]).includes(value);
}

/**
 * Deriva o canal de venda a partir de um segmento/descrição textual.
 * Espelha `channelFromSegment` do adds-rep-app. Qualquer texto não
 * reconhecido cai em CONSUMIDOR (nunca retorna null — é a regra do app).
 */
export function channelFromSegment(segment?: string | null): SalesChannel {
  const s = (segment ?? "").toLowerCase();
  if (s.includes("dentista") || s.includes("clinica") || s.includes("clínica")) {
    return "DENTISTA";
  }
  if (s.includes("distribuidora")) return "DISTRIBUIDORA";
  if (s.includes("varejista")) return "VAREJISTA";
  return "CONSUMIDOR";
}

// ============================================================
// Ponte com o Tiny ERP
// ============================================================
//
// No Tiny o canal vive no "tipo de contato". Os tipos cadastrados são:
//   cliente · dentista · distribuidora / dental · varejista ·
//   fornecedor · transportador · representante · outro
// Apenas os 4 primeiros são canais de venda; o resto NÃO vira sales_channel.
//
// Como reforço (e pra garantir round-trip mesmo se o Tiny ignorar o campo de
// tipos no POST), também gravamos/​lemos um marcador `canal:<X>`.

const CHANNEL_MARCADOR_PREFIX = "canal:";

/** "DENTISTA" → "canal:DENTISTA" */
export function salesChannelMarcadorName(channel: SalesChannel): string {
  return `${CHANNEL_MARCADOR_PREFIX}${channel}`;
}

/** sales_channel → rótulo do "tipo de contato" no Tiny. */
const SALES_CHANNEL_TO_TINY_TYPE: Record<SalesChannel, string> = {
  CONSUMIDOR: "cliente",
  DENTISTA: "dentista",
  DISTRIBUIDORA: "distribuidora / dental",
  VAREJISTA: "varejista",
};

/** Extrai o texto de um item de lista do Tiny (string ou objeto). */
function extractLabel(item: unknown, keys: string[]): string | undefined {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string") return v;
    }
    // marcador aninhado { marcador: { nome | descricao } }
    const nested = o.marcador;
    if (nested && typeof nested === "object") {
      return extractLabel(nested, keys);
    }
  }
  return undefined;
}

/**
 * Best-effort: lê o canal a partir do marcador `canal:<X>` de um contato/pedido.
 * Retorna null se nenhum marcador de canal válido for encontrado.
 */
export function salesChannelFromMarcadores(
  raw: Record<string, unknown>
): SalesChannel | null {
  const marcadores =
    (raw.marcadores as unknown[]) ?? (raw.tags as unknown[]) ?? [];
  if (!Array.isArray(marcadores)) return null;

  for (const m of marcadores) {
    const text = extractLabel(m, ["nome", "tag", "descricao"]);
    if (!text) continue;
    const t = text.trim().toLowerCase();
    if (t.startsWith(CHANNEL_MARCADOR_PREFIX)) {
      const val = t.slice(CHANNEL_MARCADOR_PREFIX.length).trim().toUpperCase();
      if (isSalesChannel(val)) return val;
    }
  }
  return null;
}

/**
 * Best-effort: deriva o sales_channel de um contato do Tiny a partir do
 * "tipo de contato" (e, como fallback, do marcador `canal:<X>`).
 *
 * Prioridade: tipo específico (dentista/distribuidora/varejista) > genérico
 * (cliente → CONSUMIDOR). Tipos não-comerciais (fornecedor, transportador,
 * representante, outro) → null (não chuta).
 *
 * ⚠️ FLAG: o nome/formato do campo de tipos na API Tiny v3 não foi validado
 * contra uma resposta real — por isso toleramos várias chaves e caímos no
 * marcador como rede de segurança. Validar quando houver payload de contato real.
 */
export function salesChannelFromTinyContact(
  raw: Record<string, unknown>
): SalesChannel | null {
  // 1) Marcador explícito (o que nós mesmos gravamos — round-trip confiável)
  const fromMarcador = salesChannelFromMarcadores(raw);
  if (fromMarcador) return fromMarcador;

  // 2) Tipo de contato (fonte de verdade no Tiny)
  const buckets: unknown[] = [];
  for (const key of ["tipos", "tiposContato", "tipoContato", "tipo"]) {
    const v = raw[key];
    if (Array.isArray(v)) buckets.push(...v);
    else if (v != null) buckets.push(v);
  }

  const labels = buckets
    .map((item) => extractLabel(item, ["descricao", "nome", "tipo", "label"]))
    .filter((l): l is string => typeof l === "string")
    .map((l) => l.toLowerCase());

  const has = (needle: string) => labels.some((l) => l.includes(needle));

  if (has("dentista")) return "DENTISTA";
  if (has("distribuidora")) return "DISTRIBUIDORA";
  if (has("varejista")) return "VAREJISTA";
  if (has("cliente")) return "CONSUMIDOR";
  return null;
}

/**
 * Anexa o marcador `canal:<X>` a um payload do Tiny (contato OU pedido), de
 * forma ADITIVA — não sobrescreve marcadores existentes. Seguro: só acrescenta.
 */
export function applyChannelMarcador<T extends Record<string, unknown>>(
  payload: T,
  channel: SalesChannel | null | undefined
): T {
  if (!channel) return payload;
  const nome = salesChannelMarcadorName(channel);
  const nomeLower = nome.toLowerCase();
  const existing = Array.isArray(payload.marcadores)
    ? [...(payload.marcadores as unknown[])]
    : [];
  const already = existing.some((m) => {
    const text = extractLabel(m, ["nome", "tag", "descricao"]);
    return typeof text === "string" && text.trim().toLowerCase() === nomeLower;
  });
  if (already) return payload;
  return { ...payload, marcadores: [...existing, { marcador: { nome } }] };
}

/**
 * Best-effort: aplica o canal num payload de CONTATO do Tiny.
 * Estratégia dupla pra maximizar compatibilidade sem quebrar a criação:
 *   1. marcador `canal:<X>` (aditivo, e o que conseguimos reler)
 *   2. "tipo de contato" nativo correspondente
 *
 * ⚠️ FLAG: o formato do campo `tipos` na API Tiny v3 não foi validado (pode
 * exigir o ID do tipo). Por isso o canal também vira marcador. Os endpoints
 * que usam isto devem ter retry sem-canal pra NUNCA quebrar o cadastro.
 */
export function applySalesChannelToTinyContact<
  T extends Record<string, unknown>,
>(payload: T, channel: SalesChannel | null | undefined): T {
  if (!channel) return payload;
  const withMarcador = applyChannelMarcador(payload, channel);
  const tipoLabel = SALES_CHANNEL_TO_TINY_TYPE[channel];
  if (!tipoLabel) return withMarcador;
  const tipos = Array.isArray(withMarcador.tipos)
    ? [...(withMarcador.tipos as unknown[])]
    : [];
  return { ...withMarcador, tipos: [...tipos, { descricao: tipoLabel }] };
}
