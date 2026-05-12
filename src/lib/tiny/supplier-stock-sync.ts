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
  depositos?: Array<{
    id?: number;
    idDeposito?: number;
    nome?: string;
    saldo?: number | string;
    estoque?: number | string;
  }>;
  data?: {
    id?: number;
    nome?: string;
    codigo?: string;
    estoque?: number | string;
    saldo?: number | string;
    depositos?: Array<{
      id?: number;
      idDeposito?: number;
      nome?: string;
      saldo?: number | string;
      estoque?: number | string;
    }>;
  };
}

export interface TinyStockResult {
  tinyId: number;
  stock: number;
  colorKey: string | null;
  depositoId: number | null;
}

function toNumber(value: number | string | undefined | null): number {
  if (value == null) return 0;
  return typeof value === "string" ? parseFloat(value) || 0 : Number(value) || 0;
}

/**
 * Lê o estoque retornado pela Tiny v3. Tenta múltiplos formatos:
 * - depósito específico via `depositos[]` (quando depositoId é informado)
 * - `estoque`/`saldo` no root ou em `data`
 */
export function extractStock(raw: TinyProductDetail, depositoId?: number | null): number {
  const root = raw?.data ?? raw;

  if (depositoId != null && Array.isArray(root.depositos)) {
    const match = root.depositos.find(
      (d) => d?.idDeposito === depositoId || d?.id === depositoId
    );
    if (match) {
      return toNumber(match.saldo ?? match.estoque);
    }
  }

  return toNumber(root.estoque ?? root.saldo);
}

/**
 * Busca estoque do Tiny para todas as variantes de cor mapeadas em `tiny_color_map`.
 * Quando não há cores mapeadas, busca pelo `tiny_id` do produto pai.
 *
 * `depositoId` é opcional: se fornecido, filtra o saldo pelo depósito; se omitido,
 * usa o saldo agregado retornado pela API.
 */
export async function fetchTinyStockForProduct(args: {
  tinyId: number | null | undefined;
  tinyColorMap: ProductColorMap | null | undefined;
  depositoId?: number | null;
}): Promise<{ results: TinyStockResult[]; errors: string[] }> {
  const { tinyId, tinyColorMap, depositoId } = args;
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
      const stock = extractStock(raw, depositoId);
      for (const colorKey of colorKeys) {
        results.push({
          tinyId: variantTinyId,
          stock,
          colorKey,
          depositoId: depositoId ?? null,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`tiny_id=${variantTinyId}: ${msg}`);
    }
  }

  // 2) Produto pai sem variantes (Cera Orto, Passafio)
  const hasMappedColors = tinyIdsToColor.size > 0;
  if (!hasMappedColors && tinyId) {
    try {
      const raw = await tinyApiGet<TinyProductDetail>(`/produtos/${tinyId}`);
      const stock = extractStock(raw, depositoId);
      results.push({
        tinyId,
        stock,
        colorKey: null,
        depositoId: depositoId ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`tiny_id=${tinyId}: ${msg}`);
    }
  }

  return { results, errors };
}
