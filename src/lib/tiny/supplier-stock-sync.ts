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
}

function toNumber(value: number | string | undefined | null): number {
  if (value == null) return 0;
  return typeof value === "string" ? parseFloat(value) || 0 : Number(value) || 0;
}

function extractListItems(payload: TinyListPayload): TinyListItem[] {
  return (
    payload.itens ??
    payload.data?.itens ??
    payload.produtos ??
    []
  );
}

/**
 * Extrai o estoque diretamente do payload de detalhe (raramente preenchido na v3).
 * Mantido como fallback.
 */
export function extractStock(raw: TinyProductDetailV3): number {
  const root = raw?.data ?? raw;
  return toNumber(root.estoque ?? root.saldo);
}

/**
 * Busca o estoque de uma variante específica via /produtos?codigo=SKU.
 * A v3 retorna o estoque na LISTAGEM (mas não no detalhe /produtos/{id}).
 * Fallback: tenta /produtos/{id} caso a busca por código não traga resultado.
 */
async function fetchStockForVariant(args: {
  tinyId: number | null | undefined;
  sku: string | null | undefined;
}): Promise<{ stock: number | null; usedSku: boolean }> {
  const { tinyId, sku } = args;

  // 1) Busca por SKU (mais confiável — match exato)
  if (sku) {
    try {
      const list = await tinyApiGet<TinyListPayload>(
        `/produtos?codigo=${encodeURIComponent(sku)}&limit=5`
      );
      const items = extractListItems(list);
      // Procura match exato pelo SKU (case-insensitive) para evitar falsos positivos
      const match =
        items.find(
          (it) =>
            (it.codigo ?? "").toUpperCase() === sku.toUpperCase() ||
            (it.sku ?? "").toUpperCase() === sku.toUpperCase()
        ) ?? items[0];
      if (match) {
        const stock = toNumber(match.estoque ?? match.saldo);
        if (match.estoque !== undefined || match.saldo !== undefined) {
          return { stock, usedSku: true };
        }
      }
    } catch {
      // segue para fallback
    }
  }

  // 2) Fallback: tenta o detalhe (caso raro em que retorna estoque)
  if (tinyId) {
    try {
      const raw = await tinyApiGet<TinyProductDetailV3>(`/produtos/${tinyId}`);
      const stock = extractStock(raw);
      const root = raw?.data ?? raw;
      if (root.estoque !== undefined || root.saldo !== undefined) {
        return { stock, usedSku: false };
      }
    } catch {
      // se falhar tudo, retorna null
    }
  }

  return { stock: null, usedSku: false };
}

/**
 * Busca o estoque total no Tiny de todas as variantes de cor mapeadas em
 * `tiny_color_map`. Quando não há cores, busca pelo `tiny_id` do produto pai.
 *
 * Retorna o saldo agregado (todos os depósitos somados). A divisão entre
 * pools PERSONALIZADO/MARKETPLACE é feita pelo usuário no inventário mensal.
 */
export async function fetchTinyStockForProduct(args: {
  tinyId: number | null | undefined;
  tinyColorMap: ProductColorMap | null | undefined;
}): Promise<{ results: TinyStockResult[]; errors: string[] }> {
  const { tinyId, tinyColorMap } = args;
  const colorMap = tinyColorMap ?? {};
  const results: TinyStockResult[] = [];
  const errors: string[] = [];

  const colorEntries = Object.entries(colorMap).filter(
    ([, m]) => m?.tiny_id || m?.sku
  );

  if (colorEntries.length > 0) {
    // Variantes mapeadas
    for (const [colorKey, mapping] of colorEntries) {
      const { stock } = await fetchStockForVariant({
        tinyId: mapping.tiny_id,
        sku: mapping.sku,
      });
      if (stock != null && mapping.tiny_id) {
        results.push({ tinyId: mapping.tiny_id, stock, colorKey });
      } else if (stock == null) {
        errors.push(
          `cor "${colorKey}": estoque não retornado pelo Tiny (sku=${
            mapping.sku ?? "—"
          }, tiny_id=${mapping.tiny_id ?? "—"})`
        );
      }
    }
  } else if (tinyId) {
    // Produto sem variantes
    const { stock } = await fetchStockForVariant({ tinyId, sku: null });
    if (stock != null) {
      results.push({ tinyId, stock, colorKey: null });
    } else {
      errors.push(`tiny_id=${tinyId}: estoque não retornado pelo Tiny`);
    }
  }

  return { results, errors };
}
