/**
 * Calculadora de cotação para orçamento público
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
  subtotal: number;
  pixDiscountRate: number;
  pixDiscountValue: number;
  totalPix: number;
  totalCard: number;
  installment4x: number;
  freteGratis: boolean;
  personalizacaoDisponivel: boolean;
}

function getItemQuantity(item: QuoteItemInput): number {
  const qpc = item.quantity_per_color && Object.keys(item.quantity_per_color).length > 0
    ? item.quantity_per_color
    : null;
  if (qpc) {
    return Object.values(qpc).reduce((a, b) => a + b, 0);
  }
  return item.quantity;
}

export function recalculateQuote(
  items: QuoteItemInput[],
  productCatalog: ProductCatalogItem[]
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

    let unitPrice: number;

    if (catalogItem) {
      const code = getProductPricingCode(catalogItem) as ProductCode | null;
      if (code) {
        const msrp = getProductMsrp(catalogItem);
        unitPrice = getUnitPriceByCode(code, msrp, totalQty);
      } else {
        unitPrice = catalogItem.price ?? 0;
      }
    } else {
      unitPrice = 0;
    }

    lineItems.push({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: qty,
      unitPrice,
      subtotal: Math.round(qty * unitPrice * 100) / 100,
    });
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.subtotal, 0);
  const pixDiscountValue = Math.round(subtotal * PRICING_CONSTANTS.PIX_DISCOUNT * 100) / 100;
  const totalPix = Math.round((subtotal - pixDiscountValue) * 100) / 100;
  const installment4x = Math.round((subtotal / PRICING_CONSTANTS.MAX_INSTALLMENTS) * 100) / 100;

  return {
    items: lineItems,
    totalQty,
    subtotal,
    pixDiscountRate: PRICING_CONSTANTS.PIX_DISCOUNT,
    pixDiscountValue,
    totalPix,
    totalCard: subtotal,
    installment4x,
    freteGratis: isFreteGratis(totalQty, subtotal),
    personalizacaoDisponivel: isCustomizationAvailable(totalQty, subtotal),
  };
}
