import { tinyApiGet } from "@/lib/tiny-api";

type ColorMapEntry = {
  tiny_id?: number | null;
  sku?: string | null;
  tiny_stock?: number | null;
};

export type ProductColorMap = Record<string, ColorMapEntry>;

interface TinyListItem {
  id?: number;
  nome?: string;
  descricao?: string;
  codigo?: string;
  sku?: string;
  estoque?: number | string;
  saldo?: number | string;
}

interface TinyListPayload {
  itens?: TinyListItem[];
  data?: { itens?: TinyListItem[] };
  produtos?: TinyListItem[];
}

interface TinyProductDetailV3 {
  id?: number;
  nome?: string;
  descricao?: string;
  codigo?: string;
  sku?: string;
  estoque?: number | string;
  saldo?: number | string;
  data?: TinyProductDetailV3;
}

export interface TinyStockResult {
  tinyId: number;
  stock: number;
  colorKey: string | null;
  /** Fonte: 'list_by_sku', 'list_by_nome', 'list_general', 'detail' */
  source?: string;
}

function toNumber(value: number | string | undefined | null): number {
  if (value == null) return 0;
  return typeof value === "string" ? parseFloat(value) || 0 : Number(value) || 0;
}

function extractListItems(payload: TinyListPayload): TinyListItem[] {
  return payload.itens ?? payload.data?.itens ?? payload.produtos ?? [];
}

function hasStock(item: TinyListItem): boolean {
  return item.estoque !== undefined || item.saldo !== undefined;
}

export function extractStock(raw: TinyProductDetailV3): number {
  const root = raw?.data ?? raw;
  return toNumber(root.estoque ?? root.saldo);
}

/**
 * Estratégia de busca de estoque na Tiny v3 (em ordem):
 *
 * 1. /produtos?codigo=SKU&limit=5 → pode trazer estoque (varia por versão)
 * 2. /produtos?nome=NomeProduto&limit=20 → SEMPRE traz estoque na listagem
 *    (caminho que /api/tiny/products usa em produção)
 * 3. /produtos/{tiny_id} (detalhe) → fallback, geralmente sem estoque na v3
 */
async function fetchStockForVariant(args: {
  tinyId: number | null | undefined;
  sku: string | null | undefined;
  productName?: string | null;
}): Promise<{ stock: number | null; source: string; debug: string[] }> {
  const { tinyId, sku, productName } = args;
  const debug: string[] = [];

  // 1) Busca por SKU
  if (sku) {
    try {
      const list = await tinyApiGet<TinyListPayload>(
        `/produtos?codigo=${encodeURIComponent(sku)}&limit=5`
      );
      const items = extractListItems(list);
      const match =
        items.find(
          (it) =>
            (it.codigo ?? "").toUpperCase() === sku.toUpperCase() ||
            (it.sku ?? "").toUpperCase() === sku.toUpperCase() ||
            it.id === tinyId
        ) ?? (items.length === 1 ? items[0] : null);
      debug.push(
        `?codigo=${sku} → ${items.length} item(s), match=${match ? `id ${match.id}` : "—"}, hasStock=${match ? hasStock(match) : false}`
      );
      if (match && hasStock(match)) {
        return {
          stock: toNumber(match.estoque ?? match.saldo),
          source: "list_by_sku",
          debug,
        };
      }
    } catch (err) {
      debug.push(`?codigo=${sku} → ${err instanceof Error ? err.message : "err"}`);
    }
  }

  // 2) Busca pelo nome do produto (Tiny match by nome retorna estoque)
  if (productName) {
    try {
      const q = productName.slice(0, 40); // limite seguro
      const list = await tinyApiGet<TinyListPayload>(
        `/produtos?nome=${encodeURIComponent(q)}&limit=30`
      );
      const items = extractListItems(list);
      const match =
        (tinyId ? items.find((it) => it.id === tinyId) : null) ??
        (sku
          ? items.find(
              (it) =>
                (it.codigo ?? "").toUpperCase() === sku.toUpperCase() ||
                (it.sku ?? "").toUpperCase() === sku.toUpperCase()
            )
          : null);
      debug.push(
        `?nome=${q} → ${items.length} item(s), match=${match ? `id ${match.id}` : "—"}, hasStock=${match ? hasStock(match) : false}`
      );
      if (match && hasStock(match)) {
        return {
          stock: toNumber(match.estoque ?? match.saldo),
          source: "list_by_nome",
          debug,
        };
      }
    } catch (err) {
      debug.push(`?nome=… → ${err instanceof Error ? err.message : "err"}`);
    }
  }

  // 3) Detalhe (raramente preenchido na v3)
  if (tinyId) {
    try {
      const raw = await tinyApiGet<TinyProductDetailV3>(`/produtos/${tinyId}`);
      const root = raw?.data ?? raw;
      const has = root.estoque !== undefined || root.saldo !== undefined;
      debug.push(
        `/produtos/${tinyId} → keys=${Object.keys(root).join(",")} hasStock=${has}`
      );
      if (has) {
        return { stock: extractStock(raw), source: "detail", debug };
      }
    } catch (err) {
      debug.push(`/produtos/${tinyId} → ${err instanceof Error ? err.message : "err"}`);
    }
  }

  return { stock: null, source: "none", debug };
}

export async function fetchTinyStockForProduct(args: {
  tinyId: number | null | undefined;
  tinyColorMap: ProductColorMap | null | undefined;
  /** Nome do produto pai (ex: "ADDS Implant") — usado em fallback de busca por nome. */
  productName?: string | null;
}): Promise<{
  results: TinyStockResult[];
  errors: string[];
}> {
  const { tinyId, tinyColorMap, productName } = args;
  const colorMap = tinyColorMap ?? {};
  const results: TinyStockResult[] = [];
  const errors: string[] = [];

  const colorEntries = Object.entries(colorMap).filter(
    ([, m]) => m?.tiny_id || m?.sku
  );

  if (colorEntries.length > 0) {
    for (const [colorKey, mapping] of colorEntries) {
      const { stock, source, debug } = await fetchStockForVariant({
        tinyId: mapping.tiny_id,
        sku: mapping.sku,
        productName,
      });
      if (stock != null && mapping.tiny_id) {
        results.push({ tinyId: mapping.tiny_id, stock, colorKey, source });
      } else {
        errors.push(`cor "${colorKey}": ${debug.join(" | ")}`);
      }
    }
  } else if (tinyId) {
    const { stock, source, debug } = await fetchStockForVariant({
      tinyId,
      sku: null,
      productName,
    });
    if (stock != null) {
      results.push({ tinyId, stock, colorKey: null, source });
    } else {
      errors.push(`tiny_id=${tinyId}: ${debug.join(" | ")}`);
    }
  }

  return { results, errors };
}
