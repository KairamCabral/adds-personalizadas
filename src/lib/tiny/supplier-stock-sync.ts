import { tinyApiGet } from "@/lib/tiny-api";

type ColorMapEntry = {
  tiny_id?: number | null;
  sku?: string | null;
  tiny_stock?: number | null;
};

export type ProductColorMap = Record<string, ColorMapEntry>;

export interface TinyProductDetail {
  id?: number;
  nome?: string;
  codigo?: string;
  estoque?: number | string;
  saldo?: number | string;
  data?: {
    id?: number;
    nome?: string;
    codigo?: string;
    estoque?: number | string;
    saldo?: number | string;
  };
}

export interface TinyStockResult {
  tinyId: number;
  stock: number;
  colorKey: string | null;
}

function toNumber(value: number | string | undefined | null): number {
  if (value == null) return 0;
  return typeof value === "string" ? parseFloat(value) || 0 : Number(value) || 0;
}

/**
 * Lê o estoque agregado retornado pela Tiny v3 em /produtos/{id}.
 * A API do escopo OAuth padrão NÃO expõe saldo por depósito; o sistema usa
 * o total agregado e o usuário (WS) declara manualmente a separação entre pools.
 */
export function extractStock(raw: TinyProductDetail): number {
  const root = raw?.data ?? raw;
  return toNumber(root.estoque ?? root.saldo);
}

/**
 * Busca o estoque total no Tiny de todas as variantes de cor mapeadas em
 * `tiny_color_map`. Quando não há cores, busca pelo `tiny_id` do produto pai.
 *
 * Retorna o saldo agregado (todos os depósitos somados). A divisão entre
 * pools PERSONALIZADO/MARKETPLACE é feita pelo usuário no inventário mensal —
 * o sistema valida coerência ao comparar `soma(declared) ≈ total Tiny`.
 */
export async function fetchTinyStockForProduct(args: {
  tinyId: number | null | undefined;
  tinyColorMap: ProductColorMap | null | undefined;
}): Promise<{ results: TinyStockResult[]; errors: string[] }> {
  const { tinyId, tinyColorMap } = args;
  const colorMap = tinyColorMap ?? {};
  const results: TinyStockResult[] = [];
  const errors: string[] = [];

  // 1) Variantes mapeadas por cor
  const tinyIdsToColor = new Map<number, string[]>();
  for (const [colorKey, mapping] of Object.entries(colorMap)) {
    if (mapping?.tiny_id) {
      const existing = tinyIdsToColor.get(mapping.tiny_id) ?? [];
      existing.push(colorKey);
      tinyIdsToColor.set(mapping.tiny_id, existing);
    }
  }

  for (const [variantTinyId, colorKeys] of tinyIdsToColor) {
    try {
      const raw = await tinyApiGet<TinyProductDetail>(`/produtos/${variantTinyId}`);
      const stock = extractStock(raw);
      for (const colorKey of colorKeys) {
        results.push({ tinyId: variantTinyId, stock, colorKey });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`tiny_id=${variantTinyId}: ${msg}`);
    }
  }

  // 2) Produto pai sem variantes (ex: Cera Orto, Passafio)
  const hasMappedColors = tinyIdsToColor.size > 0;
  if (!hasMappedColors && tinyId) {
    try {
      const raw = await tinyApiGet<TinyProductDetail>(`/produtos/${tinyId}`);
      const stock = extractStock(raw);
      results.push({ tinyId, stock, colorKey: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`tiny_id=${tinyId}: ${msg}`);
    }
  }

  return { results, errors };
}
