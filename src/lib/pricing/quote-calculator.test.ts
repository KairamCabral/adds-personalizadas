import { describe, it, expect } from "vitest";
import {
  lookupTierPrice,
  buildPricingContext,
  recalculateQuote,
  type DbTier,
  type PricingContext,
} from "./quote-calculator";
import {
  IMPLANT_PRICE_TABLE,
  ULTRA_PRICE_TABLE,
  TECHJET_PRICE_TABLE,
  PROCLEAN_PRICE_TABLE,
  TONCLEAN_PRICE_TABLE,
  getUnitPriceByCode,
  calculateDerivedPrice,
  PRICING_CONSTANTS,
} from "./dentist-pricing";

// ─── Helpers de teste ────────────────────────────────────────────────────────

function makeTiers(
  productId: string,
  table: { minQty: number; unitPrice: number }[]
): DbTier[] {
  return table.map((t) => ({
    product_id: productId,
    min_qty: t.minQty,
    unit_price: t.unitPrice,
  }));
}

const P01 = "product-implant";
const P02 = "product-ultra";
const P06 = "product-techjet";
const P08 = "product-proclean";
const P09 = "product-tonclean";

const allTiers: DbTier[] = [
  ...makeTiers(P01, IMPLANT_PRICE_TABLE),
  ...makeTiers(P02, ULTRA_PRICE_TABLE),
  ...makeTiers(P06, TECHJET_PRICE_TABLE),
  ...makeTiers(P08, PROCLEAN_PRICE_TABLE),
  ...makeTiers(P09, TONCLEAN_PRICE_TABLE),
];

const defaultSettings = { avista_discount_pct: 5 };

function makeCtx(overrides?: Partial<PricingContext>): PricingContext {
  return {
    ...buildPricingContext(allTiers, defaultSettings, []),
    ...overrides,
  };
}

// ─── lookupTierPrice ────────────────────────────────────────────────────────

describe("lookupTierPrice", () => {
  const implantTiers = makeTiers(P01, IMPLANT_PRICE_TABLE);

  it("retorna o menor tier quando qty < min_qty[0]", () => {
    expect(lookupTierPrice(implantTiers, 1)).toBe(24.0);
    expect(lookupTierPrice(implantTiers, 23)).toBe(24.0);
  });

  it("retorna o preço exato quando qty === min_qty de uma faixa", () => {
    expect(lookupTierPrice(implantTiers, 24)).toBe(24.0);
    expect(lookupTierPrice(implantTiers, 36)).toBe(22.9);
    expect(lookupTierPrice(implantTiers, 72)).toBe(21.9);
    expect(lookupTierPrice(implantTiers, 120)).toBe(19.9);
    expect(lookupTierPrice(implantTiers, 240)).toBe(19.1);
  });

  it("retorna o tier da faixa imediatamente inferior para qty intermediário", () => {
    expect(lookupTierPrice(implantTiers, 35)).toBe(24.0); // entre 24 e 36
    expect(lookupTierPrice(implantTiers, 50)).toBe(22.9); // entre 36 e 72
    expect(lookupTierPrice(implantTiers, 100)).toBe(21.9); // entre 72 e 120
    expect(lookupTierPrice(implantTiers, 200)).toBe(19.9); // entre 120 e 240
  });

  it("retorna o último tier para qty acima do maior min_qty", () => {
    expect(lookupTierPrice(implantTiers, 300)).toBe(19.1);
    expect(lookupTierPrice(implantTiers, 1000)).toBe(19.1);
  });

  it("funciona com TECHJET (min_qty inicial = 6)", () => {
    const techjetTiers = makeTiers(P06, TECHJET_PRICE_TABLE);
    expect(lookupTierPrice(techjetTiers, 1)).toBe(616.85);
    expect(lookupTierPrice(techjetTiers, 6)).toBe(616.85);
    expect(lookupTierPrice(techjetTiers, 8)).toBe(588.58);
    expect(lookupTierPrice(techjetTiers, 24)).toBe(490.91);
  });
});

// ─── buildPricingContext ─────────────────────────────────────────────────────

describe("buildPricingContext", () => {
  it("agrupa tiers por product_id", () => {
    const ctx = buildPricingContext(allTiers, defaultSettings, []);
    expect(ctx.tiersByProductId.has(P01)).toBe(true);
    expect(ctx.tiersByProductId.get(P01)!.length).toBe(5);
  });

  it("ordena tiers por min_qty ASC mesmo que venham desordenados", () => {
    const desordenados: DbTier[] = [
      { product_id: P01, min_qty: 240, unit_price: 19.1 },
      { product_id: P01, min_qty: 24, unit_price: 24.0 },
      { product_id: P01, min_qty: 72, unit_price: 21.9 },
    ];
    const ctx = buildPricingContext(desordenados, null, []);
    const tiers = ctx.tiersByProductId.get(P01)!;
    expect(tiers[0].min_qty).toBe(24);
    expect(tiers[1].min_qty).toBe(72);
    expect(tiers[2].min_qty).toBe(240);
  });

  it("converte avista_discount_pct de % para decimal", () => {
    const ctx = buildPricingContext([], { avista_discount_pct: 5 }, []);
    expect(ctx.aVistaDiscountPct).toBeCloseTo(0.05);
  });

  it("usa PRICING_CONSTANTS.PIX_DISCOUNT como fallback quando settings é null", () => {
    const ctx = buildPricingContext([], null, []);
    expect(ctx.aVistaDiscountPct).toBe(PRICING_CONSTANTS.PIX_DISCOUNT);
  });
});

// ─── Paridade hardcoded vs. banco ───────────────────────────────────────────

describe("recalculateQuote — paridade com lógica hardcoded", () => {
  const catalog = [
    { id: P01, name: "ADDS Implant", price: 34.9 },
    { id: P02, name: "ADDS Ultra", price: 34.9 },
    { id: P06, name: "ADDS TechJet", price: 897 },
    { id: P08, name: "ADDS PróClean", price: 19.9 },
    { id: P09, name: "ADDS TonClean", price: 9.9 },
  ];

  const ctx = makeCtx();

  const cases: { name: string; productId: string; code: "P01" | "P02" | "P06" | "P08" | "P09"; msrp: number; qtys: number[] }[] = [
    { name: "ADDS Implant", productId: P01, code: "P01", msrp: 34.9, qtys: [24, 36, 72, 120, 240, 35, 50] },
    { name: "ADDS Ultra", productId: P02, code: "P02", msrp: 34.9, qtys: [24, 36, 72, 120, 240] },
    { name: "ADDS TechJet", productId: P06, code: "P06", msrp: 897, qtys: [6, 8, 12, 16, 24] },
    { name: "ADDS PróClean", productId: P08, code: "P08", msrp: 19.9, qtys: [24, 36, 72, 120, 240] },
    { name: "ADDS TonClean", productId: P09, code: "P09", msrp: 9.9, qtys: [24, 36, 72, 120, 240] },
  ];

  for (const { name, productId, code, msrp, qtys } of cases) {
    for (const qty of qtys) {
      it(`${name} qty=${qty}: DB == hardcoded`, () => {
        const resultDB = recalculateQuote(
          [{ product_id: productId, product_name: name, quantity: qty }],
          catalog,
          ctx
        );
        const expectedUnitPrice = getUnitPriceByCode(code, msrp, qty);
        expect(resultDB.items[0].unitPrice).toBeCloseTo(expectedUnitPrice, 5);
      });
    }
  }

  it("fallback hardcoded quando product_id não tem tier no banco", () => {
    const unknownId = "unknown-product-id";
    const resultDB = recalculateQuote(
      [{ product_id: unknownId, product_name: "ADDS Implant", quantity: 36 }],
      catalog,
      ctx
    );
    // Fallback por nome: ADDS Implant → P01 → 22.9
    expect(resultDB.items[0].unitPrice).toBeCloseTo(22.9, 5);
  });

  it("usa products.price como último fallback (produto sem tier e sem código)", () => {
    const unknownId = "brand-new-product";
    const ctxVazio = buildPricingContext([], null, []);
    const catalogComNovo = [...catalog, { id: unknownId, name: "Produto Novo", price: 15.5 }];
    const result = recalculateQuote(
      [{ product_id: unknownId, product_name: "Produto Novo", quantity: 10 }],
      catalogComNovo,
      ctxVazio
    );
    expect(result.items[0].unitPrice).toBe(15.5);
  });
});

// ─── Desconto por volume ─────────────────────────────────────────────────────

describe("recalculateQuote — desconto por volume", () => {
  const catalog = [{ id: P01, name: "ADDS Implant", price: 34.9 }];

  it("não aplica desconto quando subtotal < min_order_value", () => {
    const ctx = makeCtx({
      volumeDiscounts: [{ min_order_value: 9999, discount_pct: 10 }],
    });
    const result = recalculateQuote(
      [{ product_id: P01, product_name: "ADDS Implant", quantity: 24 }],
      catalog,
      ctx
    );
    expect(result.volumeDiscountPct).toBe(0);
    expect(result.volumeDiscountValue).toBe(0);
  });

  it("aplica o maior desconto válido quando subtotal >= min_order_value", () => {
    // subtotal para 72 un Implant: 72 * 21.9 = 1576.8
    const ctx = makeCtx({
      volumeDiscounts: [
        { min_order_value: 500, discount_pct: 5 },
        { min_order_value: 1000, discount_pct: 10 },
        { min_order_value: 2000, discount_pct: 15 }, // não atingido
      ],
    });
    const result = recalculateQuote(
      [{ product_id: P01, product_name: "ADDS Implant", quantity: 72 }],
      catalog,
      ctx
    );
    expect(result.volumeDiscountPct).toBe(10);
    expect(result.volumeDiscountValue).toBeCloseTo(1576.8 * 0.1, 2);
  });

  it("aplica desconto por volume antes do desconto à vista", () => {
    const ctx = makeCtx({
      volumeDiscounts: [{ min_order_value: 100, discount_pct: 10 }],
    });
    // 24 un Implant: 24 * 24.0 = 576
    const result = recalculateQuote(
      [{ product_id: P01, product_name: "ADDS Implant", quantity: 24 }],
      catalog,
      ctx
    );
    const expectedSubtotal = 576;
    const expectedAfterVolume = expectedSubtotal * 0.9; // -10%
    const expectedPix = expectedAfterVolume * (1 - 0.05);
    expect(result.subtotalAfterVolume).toBeCloseTo(expectedAfterVolume, 2);
    expect(result.totalPix).toBeCloseTo(expectedPix, 2);
  });
});

// ─── avista_discount_pct dinâmico ───────────────────────────────────────────

describe("recalculateQuote — avista_discount_pct do banco", () => {
  const catalog = [{ id: P01, name: "ADDS Implant", price: 34.9 }];

  it("usa avista_discount_pct=3% quando settings traz 3", () => {
    const ctx = buildPricingContext(
      makeTiers(P01, IMPLANT_PRICE_TABLE),
      { avista_discount_pct: 3 },
      []
    );
    // 24 un: 24 * 24.0 = 576; pix = 576 * 0.03 = 17.28; total = 558.72
    const result = recalculateQuote(
      [{ product_id: P01, product_name: "ADDS Implant", quantity: 24 }],
      catalog,
      ctx
    );
    expect(result.pixDiscountRate).toBeCloseTo(0.03);
    expect(result.pixDiscountValue).toBeCloseTo(576 * 0.03, 2);
  });

  it("usa 5% como fallback quando pricingContext é undefined", () => {
    const result = recalculateQuote(
      [{ product_id: P01, product_name: "ADDS Implant", quantity: 24 }],
      catalog
    );
    expect(result.pixDiscountRate).toBe(PRICING_CONSTANTS.PIX_DISCOUNT);
  });

  it("sem contexto: comportamento idêntico ao anterior (subtotalAfterVolume = subtotal)", () => {
    const result = recalculateQuote(
      [{ product_id: P01, product_name: "ADDS Implant", quantity: 24 }],
      catalog
    );
    expect(result.volumeDiscountPct).toBe(0);
    expect(result.volumeDiscountValue).toBe(0);
    expect(result.subtotalAfterVolume).toBe(result.subtotal);
    expect(result.totalCard).toBe(result.subtotal);
  });
});

// ─── Casos derivados (P03/P04/P05/P07) ──────────────────────────────────────

describe("recalculateQuote — produtos derivados sem tier no banco", () => {
  const orthoId = "product-orthoguard";
  const catalog = [
    { id: P01, name: "ADDS Implant", price: 34.9 },
    { id: orthoId, name: "ADDS OrthoGuard", price: 7.6 },
  ];

  it("OrthoGuard sem tier usa calculateDerivedPrice como fallback", () => {
    const ctx = buildPricingContext(
      makeTiers(P01, IMPLANT_PRICE_TABLE),
      defaultSettings,
      []
    );
    // 36 un total: OrthoGuard → calculateDerivedPrice(7.6, 36)
    const result = recalculateQuote(
      [
        { product_id: P01, product_name: "ADDS Implant", quantity: 20 },
        { product_id: orthoId, product_name: "ADDS OrthoGuard", quantity: 16 },
      ],
      catalog,
      ctx
    );
    const totalQty = 36;
    const expectedOrtho = calculateDerivedPrice(7.6, totalQty);
    const orthoLine = result.items.find((i) => i.product_id === orthoId)!;
    expect(orthoLine.unitPrice).toBeCloseTo(expectedOrtho, 5);
  });
});
