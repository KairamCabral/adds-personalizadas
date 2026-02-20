/**
 * Mapeamento de produtos do sistema para códigos de precificação (P01-P09)
 * Produtos sem mapeamento usam price do banco como fallback
 */

import type { ProductCode } from "./dentist-pricing";

export interface ProductCatalogItem {
  id: string;
  name: string;
  price: number | null;
  category?: string | null;
}

export interface ProductPricingMeta {
  code: ProductCode;
  msrp: number;
  minOrderQty: number;
  customizable: boolean;
}

/** Mapeamento por nome (case-insensitive, trim) - produtos cadastrados no sistema */
const NAME_TO_CODE: Record<string, ProductPricingMeta> = {
  "adds implant": { code: "P01", msrp: 34.9, minOrderQty: 24, customizable: true },
  "adds ultra": { code: "P02", msrp: 34.9, minOrderQty: 24, customizable: true },
  "adds orthoguard": { code: "P03", msrp: 7.6, minOrderQty: 24, customizable: false },
  "adds expanding": { code: "P04", msrp: 19.9, minOrderQty: 24, customizable: false },
  "interdental": { code: "P05", msrp: 14.8, minOrderQty: 24, customizable: false },
  "adds techjet": { code: "P06", msrp: 897, minOrderQty: 6, customizable: true },
  "adds passclean": { code: "P07", msrp: 9.9, minOrderQty: 24, customizable: false },
  "adds próclean": { code: "P08", msrp: 19.9, minOrderQty: 24, customizable: true },
  "adds proclean": { code: "P08", msrp: 19.9, minOrderQty: 24, customizable: true },
  "adds tonclean": { code: "P09", msrp: 9.9, minOrderQty: 24, customizable: true },
};

function normalizeName(name: string): string {
  return name.toLowerCase().trim().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function getProductPricingMeta(
  product: ProductCatalogItem
): ProductPricingMeta | null {
  const key = normalizeName(product.name);
  return NAME_TO_CODE[key] ?? null;
}

export function getProductPricingCode(
  product: ProductCatalogItem
): ProductCode | null {
  return getProductPricingMeta(product)?.code ?? null;
}

export function getProductMsrp(product: ProductCatalogItem): number {
  const meta = getProductPricingMeta(product);
  if (meta) return meta.msrp;
  return product.price ?? 0;
}
