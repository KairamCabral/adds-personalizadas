import { tinyApiGet } from "@/lib/tiny-api";

type ColorMapEntry = {
  tiny_id?: number | null;
  sku?: string | null;
  tiny_stock?: number | null;
};

export type ProductColorMap = Record<string, ColorMapEntry>;

/**
 * Resposta do endpoint Tiny v3 `/estoque/{idProduto}`.
 * Contém saldo, reservado, disponível agregados + lista de depósitos.
 */
interface TinyEstoqueResponse {
  id?: number;
  nome?: string;
  codigo?: string;
  unidade?: string;
  saldo?: number | string;
  reservado?: number | string;
  disponivel?: number | string;
  localizacao?: string;
  depositos?: Array<TinyDepositoSaldoRaw>;
  data?: TinyEstoqueResponse;
}

interface TinyDepositoSaldoRaw {
  id?: number;
  nome?: string;
  desconsiderar?: boolean;
  saldo?: number | string;
  reservado?: number | string;
  disponivel?: number | string;
  empresa?: string;
}

export interface TinyDepositoSaldo {
  id: number;
  nome: string;
  desconsiderar: boolean;
  saldo: number;
  reservado: number;
  disponivel: number;
  empresa: string | null;
}

export interface TinyStockResult {
  tinyId: number;
  colorKey: string | null;
  /** Saldo total agregado (todos os depósitos exceto desconsiderar=true) */
  totalSaldo: number;
  /** Reservado total agregado */
  totalReservado: number;
  /** Disponível total agregado (saldo - reservado) */
  totalDisponivel: number;
  /** Lista completa de depósitos com saldo de cada */
  depositos: TinyDepositoSaldo[];
}

function toNumber(value: number | string | undefined | null): number {
  if (value == null) return 0;
  return typeof value === "string" ? parseFloat(value) || 0 : Number(value) || 0;
}

function mapDeposito(raw: TinyDepositoSaldoRaw): TinyDepositoSaldo | null {
  if (!raw?.id) return null;
  return {
    id: raw.id,
    nome: raw.nome ?? `Depósito ${raw.id}`,
    desconsiderar: raw.desconsiderar === true,
    saldo: toNumber(raw.saldo),
    reservado: toNumber(raw.reservado),
    disponivel: toNumber(raw.disponivel),
    empresa: typeof raw.empresa === "string" ? raw.empresa : null,
  };
}

/**
 * Busca o estoque completo (todos os depósitos) de uma variante via /estoque/{tiny_id}.
 * Esse é o ÚNICO endpoint da Tiny v3 (escopo OAuth padrão) que expõe saldo por depósito.
 */
async function fetchEstoqueByTinyId(
  tinyId: number
): Promise<{
  totalSaldo: number;
  totalReservado: number;
  totalDisponivel: number;
  depositos: TinyDepositoSaldo[];
} | null> {
  try {
    const raw = await tinyApiGet<TinyEstoqueResponse>(`/estoque/${tinyId}`);
    const root = raw?.data ?? raw;
    const depositos: TinyDepositoSaldo[] = (root.depositos ?? [])
      .map(mapDeposito)
      .filter((d): d is TinyDepositoSaldo => d !== null);

    // Usa os totais que o próprio Tiny envia (já agregados)
    const totalSaldo = toNumber(root.saldo);
    const totalReservado = toNumber(root.reservado);
    const totalDisponivel = toNumber(root.disponivel);

    return { totalSaldo, totalReservado, totalDisponivel, depositos };
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) {
      // Produto não existe no Tiny
      return null;
    }
    throw err;
  }
}

/**
 * Busca o estoque no Tiny de todas as variantes mapeadas em `tiny_color_map`.
 * Quando não há cores, busca pelo `tiny_id` do produto pai.
 *
 * Retorna saldo COMPLETO por depósito de cada variante. O caller filtra
 * pelo depósito de interesse via `pickDepositoSaldo`.
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
    ([, m]) => m?.tiny_id
  );

  if (colorEntries.length > 0) {
    for (const [colorKey, mapping] of colorEntries) {
      const variantTinyId = mapping.tiny_id!;
      try {
        const data = await fetchEstoqueByTinyId(variantTinyId);
        if (!data) {
          errors.push(`cor "${colorKey}": produto tiny_id=${variantTinyId} não encontrado`);
          continue;
        }
        results.push({
          tinyId: variantTinyId,
          colorKey,
          totalSaldo: data.totalSaldo,
          totalReservado: data.totalReservado,
          totalDisponivel: data.totalDisponivel,
          depositos: data.depositos,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`cor "${colorKey}" (tiny_id=${variantTinyId}): ${msg}`);
      }
    }
  } else if (tinyId) {
    try {
      const data = await fetchEstoqueByTinyId(tinyId);
      if (!data) {
        errors.push(`tiny_id=${tinyId}: produto não encontrado`);
      } else {
        results.push({
          tinyId,
          colorKey: null,
          totalSaldo: data.totalSaldo,
          totalReservado: data.totalReservado,
          totalDisponivel: data.totalDisponivel,
          depositos: data.depositos,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`tiny_id=${tinyId}: ${msg}`);
    }
  }

  return { results, errors };
}

/**
 * Retorna o saldo de uma variante no depósito específico, ou null se o depósito
 * não está na lista. Usado quando o pool tem `tiny_deposito_*_id` configurado.
 */
export function pickDepositoSaldo(
  result: TinyStockResult,
  depositoId: number | null | undefined
): TinyDepositoSaldo | null {
  if (depositoId == null) return null;
  return result.depositos.find((d) => d.id === depositoId) ?? null;
}
