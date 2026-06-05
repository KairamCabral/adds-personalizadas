/**
 * Calculadora de cotação para orçamento público.
 * Quando `pricingContext` é fornecido, usa tiers do banco de dados (Fase 4).
 * Sem contexto, mantém comportamento hardcoded anterior como fallback.
 */

import {
  getUnitPriceByCode,
  isFreteGratis,
  isCustomizationAvailable,
  PRICING_CONSTANTS,
  type ProductCode,
} from "./dentist-pricing";
import {
  getProductPricingCode,
  getProductMsrp,
  type ProductCatalogItem,
} from "./product-pricing-config";

// ─── Tipos do contexto DB ───────────────────────────────────────────────────

export interface DbTier {
  product_id: string;
  min_qty: number;
  unit_price: number;
}

export interface PricingContext {
  /** product_id → faixas ordenadas por min_qty ASC */
  tiersByProductId: Map<string, DbTier[]>;
  /** Desconto à vista em decimal (ex.: 0.05 para 5%). Fonte: pricing_settings. */
  aVistaDiscountPct: number;
  /** Descontos por volume ordenados por min_order_value ASC. */
  volumeDiscounts: {
    min_order_value: number;
    discount_pct: number;
  }[];
}

/**
 * Constrói um PricingContext a partir dos dados brutos vindos da API.
 * Função pura, segura para usar em useMemo.
 */
export function buildPricingContext(
  tiers: DbTier[],
  settings: { avista_discount_pct: number } | null,
  volumeDiscounts: { min_order_value: number; discount_pct: number }[]
): PricingContext {
  const tiersByProductId = new Map<string, DbTier[]>();
  for (const tier of tiers) {
    if (!tiersByProductId.has(tier.product_id)) {
      tiersByProductId.set(tier.product_id, []);
    }
    tiersByProductId.get(tier.product_id)!.push(tier);
  }
  // Garantir ordenação ASC por min_qty
  for (const [, arr] of tiersByProductId) {
    arr.sort((a, b) => a.min_qty - b.min_qty);
  }
  return {
    tiersByProductId,
    aVistaDiscountPct:
      settings != null ? settings.avista_discount_pct / 100 : PRICING_CONSTANTS.PIX_DISCOUNT,
    volumeDiscounts,
  };
}

/**
 * Dada uma lista de faixas de um produto, retorna o preço unitário para totalQty.
 * Regra: maior min_qty que ainda seja <= totalQty. Abaixo do menor min_qty, usa o menor preço.
 */
export function lookupTierPrice(
  tiers: DbTier[],
  totalQty: number
): number {
  let price = tiers[0].unit_price;
  for (const tier of tiers) {
    if (totalQty >= tier.min_qty) {
      price = tier.unit_price;
    } else {
      break;
    }
  }
  return price;
}

// ─── Tipos de entrada/saída ─────────────────────────────────────────────────

export interface QuoteItemInput {
  product_id: string;
  product_name: string;
  quantity: number;
  quantity_per_color?: Record<string, number>;
}

export interface QuoteLineItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface QuoteSummary {
  items: QuoteLineItem[];
  totalQty: number;
  /** Subtotal bruto antes de qualquer desconto. */
  subtotal: number;
  /** Desconto por volume aplicado (0 se nenhum). */
  volumeDiscountPct: number;
  volumeDiscountValue: number;
  /** Subtotal após desconto por volume — base para os cálculos à vista / cartão. */
  subtotalAfterVolume: number;
  /** Taxa de desconto à vista em decimal (0.05 = 5%). */
  pixDiscountRate: number;
  pixDiscountValue: number;
  /** Total à vista (PIX / Boleto). */
  totalPix: number;
  /** Total no cartão (sem juros, sem desconto à vista). */
  totalCard: number;
  installment4x: number;
  freteGratis: boolean;
  personalizacaoDisponivel: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getItemQuantity(item: QuoteItemInput): number {
  const qpc =
    item.quantity_per_color &&
    Object.keys(item.quantity_per_color).length > 0
      ? item.quantity_per_color
      : null;
  if (qpc) {
    return Object.values(qpc).reduce((a, b) => a + b, 0);
  }
  return item.quantity;
}

function resolveUnitPrice(
  item: QuoteItemInput,
  catalogItem: ProductCatalogItem | undefined,
  totalQty: number,
  ctx: PricingContext | undefined
): number {
  // 1. Tiers do banco por product_id (fonte de verdade)
  if (ctx) {
    const tiers = ctx.tiersByProductId.get(item.product_id);
    if (tiers && tiers.length > 0) {
      return lookupTierPrice(tiers, totalQty);
    }
  }

  // 2. Fallback: lógica hardcoded por código de produto
  if (catalogItem) {
    const code = getProductPricingCode(catalogItem) as ProductCode | null;
    if (code) {
      const msrp = getProductMsrp(catalogItem);
      return getUnitPriceByCode(code, msrp, totalQty);
    }
    return catalogItem.price ?? 0;
  }

  return 0;
}

// ─── Função principal ───────────────────────────────────────────────────────

export function recalculateQuote(
  items: QuoteItemInput[],
  productCatalog: ProductCatalogItem[],
  pricingContext?: PricingContext
): QuoteSummary {
  const totalQty = items.reduce((sum, item) => sum + getItemQuantity(item), 0);

  const catalogById = new Map(productCatalog.map((p) => [p.id, p]));
  const catalogByName = new Map(
    productCatalog.map((p) => [p.name.toLowerCase().trim(), p])
  );

  const lineItems: QuoteLineItem[] = [];

  for (const item of items) {
    const qty = getItemQuantity(item);
    if (qty <= 0) continue;

    const catalogItem =
      catalogById.get(item.product_id) ??
      catalogByName.get(item.product_name.toLowerCase().trim());

    const unitPrice = resolveUnitPrice(item, catalogItem, totalQty, pricingContext);

    lineItems.push({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: qty,
      unitPrice,
      subtotal: round2(qty * unitPrice),
    });
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.subtotal, 0);

  // Desconto por volume (maior aplicável ao subtotal)
  let volumeDiscountPct = 0;
  if (pricingContext) {
    for (const vd of pricingContext.volumeDiscounts) {
      if (subtotal >= vd.min_order_value && vd.discount_pct > volumeDiscountPct) {
        volumeDiscountPct = vd.discount_pct;
      }
    }
  }
  const volumeDiscountValue = round2(subtotal * (volumeDiscountPct / 100));
  const subtotalAfterVolume = round2(subtotal - volumeDiscountValue);

  // Desconto à vista (PIX / Boleto)
  const aVistaRate = pricingContext?.aVistaDiscountPct ?? PRICING_CONSTANTS.PIX_DISCOUNT;
  const pixDiscountValue = round2(subtotalAfterVolume * aVistaRate);
  const totalPix = round2(subtotalAfterVolume - pixDiscountValue);
  const installment4x = round2(subtotalAfterVolume / PRICING_CONSTANTS.MAX_INSTALLMENTS);

  return {
    items: lineItems,
    totalQty,
    subtotal,
    volumeDiscountPct,
    volumeDiscountValue,
    subtotalAfterVolume,
    pixDiscountRate: aVistaRate,
    pixDiscountValue,
    totalPix,
    totalCard: subtotalAfterVolume,
    installment4x,
    freteGratis: isFreteGratis(totalQty, subtotalAfterVolume),
    personalizacaoDisponivel: isCustomizationAvailable(totalQty, subtotalAfterVolume),
  };
}
