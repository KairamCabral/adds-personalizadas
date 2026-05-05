import { createHash } from "node:crypto";
import type { Json } from "@/types/database.types";

/**
 * Helpers puros para o re-sync de pedido Tiny → CRM via webhook
 * `atualizacao_pedido`. Tiny é fonte da verdade pro pedido inteiro
 * (cliente, itens, endereço, situação), mas a "camada CRM" sobre os itens
 * personalizados é preservada — esse arquivo concentra essa fronteira.
 *
 * - `computeTinyOrderHash`: SHA-256 estável do snapshot relevante. Usado pra
 *   short-circuit (se hash bate com `orders.tiny_sync_hash`, webhook é no-op).
 * - `mergeItemsPreservingPersonalization`: merge de itens novos (Tiny) com
 *   itens existentes (CRM), mantendo `personalization.custom_color/notes`
 *   quando casa por (product_id, color).
 */

/** Campos da `personalization` que o CRM dona (Tiny não enxerga). */
const CRM_OWNED_PERSONALIZATION_KEYS = ["custom_color", "notes"] as const;

type ExistingItemForMerge = {
  product_id: string | null;
  color: string | null;
  personalization: Json | null;
};

type FreshItem = {
  product_id: string | null;
  color: string | null;
  personalization: Json | null;
};

function isJsonObject(v: unknown): v is Record<string, Json> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function itemKey(productId: string | null, color: string | null): string {
  return `${productId ?? ""}::${color ?? ""}`;
}

/**
 * Pra cada item novo (do Tiny), se houver um existente com mesmo
 * (product_id, color), copia `custom_color` e `notes` da personalização
 * antiga. Demais campos (qty, valor, color label, colors[]) seguem o Tiny.
 *
 * Itens existentes que não casam com nenhum novo são descartados — quem
 * chama é responsável por apagar antes de inserir os mergeados.
 */
export function mergeItemsPreservingPersonalization<T extends FreshItem>(
  fresh: T[],
  existing: ExistingItemForMerge[]
): T[] {
  if (existing.length === 0 || fresh.length === 0) return fresh;

  const existingByKey = new Map<string, ExistingItemForMerge>();
  for (const e of existing) {
    existingByKey.set(itemKey(e.product_id, e.color), e);
  }

  return fresh.map((f) => {
    const match = existingByKey.get(itemKey(f.product_id, f.color));
    if (!match) return f;

    const oldP = isJsonObject(match.personalization) ? match.personalization : null;
    if (!oldP) return f;

    const newP = isJsonObject(f.personalization) ? f.personalization : {};
    const merged: Record<string, Json> = { ...newP };
    let touched = false;

    for (const k of CRM_OWNED_PERSONALIZATION_KEYS) {
      const v = oldP[k];
      if (v !== undefined && v !== null && v !== "") {
        merged[k] = v;
        touched = true;
      }
    }

    if (!touched) return f;
    return { ...f, personalization: merged as Json };
  });
}

/**
 * Snapshot mínimo do pedido Tiny pro hash. Codifica só o que importa pra
 * detectar mudança de conteúdo do pedido — chaves voláteis (timestamps,
 * marcadores, IDs internos do ERP) ficam de fora pra não invalidar o cache.
 */
function pickHashableTinyOrder(raw: Record<string, unknown>): unknown {
  const cliente =
    raw.cliente && typeof raw.cliente === "object"
      ? (raw.cliente as Record<string, unknown>)
      : {};
  const endCli = (cliente.endereco as Record<string, unknown> | undefined) ?? {};
  const endEnt = (raw.enderecoEntrega as Record<string, unknown> | undefined) ?? {};
  const itensRaw = Array.isArray(raw.itens) ? raw.itens : [];

  return {
    cliente: {
      id: cliente.id ?? null,
      nome: cliente.nome ?? null,
      fantasia: cliente.fantasia ?? cliente.nomeFantasia ?? null,
      tipoPessoa: cliente.tipoPessoa ?? null,
      cpfCnpj: cliente.cpfCnpj ?? cliente.cpf_cnpj ?? null,
      email: cliente.email ?? null,
      fone: cliente.fone ?? cliente.telefone ?? null,
      celular: cliente.celular ?? null,
      endereco: pickAddressForHash(endCli),
    },
    enderecoEntrega: pickAddressForHash(endEnt),
    situacao: raw.situacao ?? null,
    dataPrevista: raw.dataPrevista ?? raw.data_prevista ?? null,
    dataPedido: raw.dataPedido ?? raw.data_pedido ?? raw.data ?? null,
    valor: raw.valor ?? raw.total ?? raw.valorTotal ?? null,
    observacoes: raw.observacoes ?? null,
    observacoesInternas:
      raw.observacoesInternas ?? raw.obs_internas ?? null,
    itens: normalizeItensForHash(itensRaw),
  };
}

function pickAddressForHash(end: Record<string, unknown>): unknown {
  return {
    endereco: end.endereco ?? null,
    numero: end.numero ?? null,
    complemento: end.complemento ?? null,
    bairro: end.bairro ?? null,
    municipio: end.municipio ?? end.cidade ?? null,
    uf: end.uf ?? null,
    cep: end.cep ?? null,
  };
}

function normalizeItensForHash(itens: unknown[]): unknown[] {
  const out: {
    tinyProductId: number | null;
    sku: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
  }[] = [];

  for (const ti of itens) {
    if (!ti || typeof ti !== "object") continue;
    const t = ti as Record<string, unknown>;
    const lineItem = (t.item && typeof t.item === "object" ? t.item : t) as Record<string, unknown>;
    const prodNested =
      lineItem.produto && typeof lineItem.produto === "object"
        ? (lineItem.produto as Record<string, unknown>)
        : undefined;

    const tinyProductIdRaw = prodNested?.id ?? lineItem.produto_id ?? lineItem.idProduto;
    const tinyProductId =
      typeof tinyProductIdRaw === "number"
        ? tinyProductIdRaw
        : tinyProductIdRaw != null && Number.isFinite(Number(tinyProductIdRaw))
          ? Number(tinyProductIdRaw)
          : null;

    const sku =
      (typeof lineItem.codigo === "string" ? lineItem.codigo : null) ??
      (typeof lineItem.sku === "string" ? lineItem.sku : null) ??
      (typeof prodNested?.sku === "string" ? (prodNested.sku as string) : null) ??
      (typeof prodNested?.codigo === "string" ? (prodNested.codigo as string) : null) ??
      "";

    const descricao =
      (typeof lineItem.descricao === "string" ? lineItem.descricao : null) ??
      (typeof prodNested?.descricao === "string" ? (prodNested.descricao as string) : null) ??
      (typeof lineItem.nome === "string" ? lineItem.nome : null) ??
      "";

    const qty = Number(lineItem.quantidade ?? lineItem.qtd ?? 0);
    const vu = Number(lineItem.valorUnitario ?? lineItem.valor_unitario ?? 0);

    out.push({
      tinyProductId,
      sku: sku.trim(),
      descricao: descricao.trim(),
      quantidade: Number.isFinite(qty) ? qty : 0,
      valorUnitario: Number.isFinite(vu) ? vu : 0,
    });
  }

  // Ordem determinística (Tiny pode reordenar itens entre webhooks).
  out.sort((a, b) => {
    const ai = a.tinyProductId ?? 0;
    const bi = b.tinyProductId ?? 0;
    if (ai !== bi) return ai - bi;
    if (a.sku !== b.sku) return a.sku < b.sku ? -1 : 1;
    return 0;
  });

  return out;
}

function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJSON).join(",") + "]";
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return (
    "{" +
    entries
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`)
      .join(",") +
    "}"
  );
}

/** SHA-256 hex do snapshot Tiny normalizado pra hash. */
export function computeTinyOrderHash(raw: Record<string, unknown>): string {
  const payload = pickHashableTinyOrder(raw);
  const json = canonicalJSON(payload);
  return createHash("sha256").update(json).digest("hex");
}
