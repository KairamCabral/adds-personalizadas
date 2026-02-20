/**
 * Lógica de precificação para dentistas - ADDS Brasil
 * Baseado em ADDS_CURSOR_PROMPT_DENTISTAS.md
 */

export type ProductCode = "P01" | "P02" | "P03" | "P04" | "P05" | "P06" | "P07" | "P08" | "P09";

export interface PriceTier {
  minQty: number;
  unitPrice: number;
}

export const IMPLANT_PRICE_TABLE: PriceTier[] = [
  { minQty: 24, unitPrice: 24.0 },
  { minQty: 36, unitPrice: 22.9 },
  { minQty: 72, unitPrice: 21.9 },
  { minQty: 120, unitPrice: 19.9 },
  { minQty: 240, unitPrice: 19.1 },
];

export const ULTRA_PRICE_TABLE: PriceTier[] = [
  { minQty: 24, unitPrice: 20.9 },
  { minQty: 36, unitPrice: 19.9 },
  { minQty: 72, unitPrice: 18.9 },
  { minQty: 120, unitPrice: 16.9 },
  { minQty: 240, unitPrice: 16.4 },
];

export const TECHJET_PRICE_TABLE: PriceTier[] = [
  { minQty: 6, unitPrice: 616.85 },
  { minQty: 8, unitPrice: 588.58 },
  { minQty: 12, unitPrice: 562.87 },
  { minQty: 16, unitPrice: 511.47 },
  { minQty: 24, unitPrice: 490.91 },
];

export const PROCLEAN_PRICE_TABLE: PriceTier[] = [
  { minQty: 24, unitPrice: 13.68 },
  { minQty: 36, unitPrice: 13.06 },
  { minQty: 72, unitPrice: 12.49 },
  { minQty: 120, unitPrice: 11.35 },
  { minQty: 240, unitPrice: 10.89 },
];

export const TONCLEAN_PRICE_TABLE: PriceTier[] = [
  { minQty: 24, unitPrice: 6.81 },
  { minQty: 36, unitPrice: 6.5 },
  { minQty: 72, unitPrice: 6.21 },
  { minQty: 120, unitPrice: 5.64 },
  { minQty: 240, unitPrice: 5.42 },
];

export const IMPLANT_MSRP = 34.9;

export const PRICING_CONSTANTS = {
  PIX_DISCOUNT: 0.05,
  MAX_INSTALLMENTS: 4,
  FREE_SHIPPING_MIN_QTY: 12,
  FREE_SHIPPING_MIN_VALUE: 200,
  CUSTOMIZATION_MIN_QTY: 24,
  CUSTOMIZATION_MIN_VALUE: 480,
};

export function lookupImplantPrice(totalQty: number): number {
  let price = IMPLANT_PRICE_TABLE[0].unitPrice;
  for (const tier of IMPLANT_PRICE_TABLE) {
    if (totalQty >= tier.minQty) {
      price = tier.unitPrice;
    } else {
      break;
    }
  }
  return price;
}

export function lookupFromTable(
  table: PriceTier[],
  qty: number
): number {
  let price = table[0].unitPrice;
  for (const tier of table) {
    if (qty >= tier.minQty) {
      price = tier.unitPrice;
    } else {
      break;
    }
  }
  return price;
}

export function calculateDerivedPrice(
  productMsrp: number,
  totalOrderQty: number
): number {
  const implantPriceAtQty = lookupImplantPrice(totalOrderQty);
  const ratio = implantPriceAtQty / IMPLANT_MSRP;
  return Math.round(productMsrp * ratio * 100) / 100;
}

export function getUnitPriceByCode(
  code: ProductCode | null,
  msrp: number,
  totalOrderQty: number
): number {
  if (totalOrderQty === 0) return msrp;

  switch (code) {
    case "P01":
      return lookupFromTable(IMPLANT_PRICE_TABLE, totalOrderQty);
    case "P02":
      return lookupFromTable(ULTRA_PRICE_TABLE, totalOrderQty);
    case "P06":
      return lookupFromTable(TECHJET_PRICE_TABLE, totalOrderQty);
    case "P08":
      return lookupFromTable(PROCLEAN_PRICE_TABLE, totalOrderQty);
    case "P09":
      return lookupFromTable(TONCLEAN_PRICE_TABLE, totalOrderQty);
    case "P03":
    case "P04":
    case "P05":
    case "P07":
      return calculateDerivedPrice(msrp, totalOrderQty);
    default:
      return msrp;
  }
}

export function isFreteGratis(totalQty: number, subtotal: number): boolean {
  return (
    totalQty >= PRICING_CONSTANTS.FREE_SHIPPING_MIN_QTY ||
    subtotal >= PRICING_CONSTANTS.FREE_SHIPPING_MIN_VALUE
  );
}

export function isCustomizationAvailable(
  totalQty: number,
  subtotal: number
): boolean {
  return (
    totalQty >= PRICING_CONSTANTS.CUSTOMIZATION_MIN_QTY ||
    subtotal >= PRICING_CONSTANTS.CUSTOMIZATION_MIN_VALUE
  );
}
