import { describe, it, expect } from "vitest";
import {
  isCashbackEligible,
  buildCreditSnapshot,
  creditValidUntil,
  type CashbackConfig,
} from "./credit";

function cfg(overrides: Partial<CashbackConfig> = {}): CashbackConfig {
  return {
    id: "ed-1",
    cashback_enabled: true,
    cashback_type: "PERCENT",
    cashback_value: 10,
    cashback_min_order_value: 300,
    cashback_min_order_qty: null,
    cashback_eligibility: "ALL",
    cashback_valid_days: 90,
    ...overrides,
  };
}

describe("isCashbackEligible", () => {
  it("cashback desligado → não elegível", () => {
    expect(isCashbackEligible(cfg({ cashback_enabled: false }), false)).toBe(
      false
    );
  });

  it("config incompleta (sem type/value) → não elegível", () => {
    expect(isCashbackEligible(cfg({ cashback_type: null }), false)).toBe(false);
    expect(isCashbackEligible(cfg({ cashback_value: null }), false)).toBe(false);
  });

  it("ALL → elegível para novo e existente", () => {
    expect(isCashbackEligible(cfg({ cashback_eligibility: "ALL" }), false)).toBe(
      true
    );
    expect(isCashbackEligible(cfg({ cashback_eligibility: "ALL" }), true)).toBe(
      true
    );
  });

  it("NEW_ONLY → só para quem NÃO é cliente existente", () => {
    const c = cfg({ cashback_eligibility: "NEW_ONLY" });
    expect(isCashbackEligible(c, false)).toBe(true); // novo
    expect(isCashbackEligible(c, true)).toBe(false); // existente
  });

  it("eligibility ausente → tratado como ALL", () => {
    expect(
      isCashbackEligible(cfg({ cashback_eligibility: null }), true)
    ).toBe(true);
  });
});

describe("creditValidUntil", () => {
  it("soma os dias e retorna YYYY-MM-DD", () => {
    expect(creditValidUntil(new Date("2026-07-10T12:00:00Z"), 90)).toBe(
      "2026-10-08"
    );
  });
  it("sem validade → null", () => {
    expect(creditValidUntil(new Date("2026-07-10T12:00:00Z"), null)).toBeNull();
  });
});

describe("buildCreditSnapshot", () => {
  const now = new Date("2026-07-10T12:00:00Z");

  it("copia as regras da edição e nasce ATIVO", () => {
    const snap = buildCreditSnapshot(
      cfg({ cashback_type: "FIXED", cashback_value: 50 }),
      "reg-1",
      { isExistingClient: false, matchedClientId: null },
      now
    );
    expect(snap).toMatchObject({
      registration_id: "reg-1",
      edition_id: "ed-1",
      client_id: null,
      type: "FIXED",
      value: 50,
      min_order_value: 300,
      status: "ATIVO",
      valid_until: "2026-10-08",
    });
  });

  it("propaga o client_id casado quando houver", () => {
    const snap = buildCreditSnapshot(
      cfg(),
      "reg-2",
      { isExistingClient: true, matchedClientId: "cli-9" },
      now
    );
    expect(snap.client_id).toBe("cli-9");
  });
});
