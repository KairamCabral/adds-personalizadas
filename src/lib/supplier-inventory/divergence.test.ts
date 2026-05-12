import { describe, it, expect } from "vitest";
import { classifyDivergence, currentReferenceMonth } from "./divergence";

describe("classifyDivergence", () => {
  const threshold = 10;

  it("retorna BREAK quando committed > declared (ruptura)", () => {
    expect(
      classifyDivergence({ declared: 100, committed: 150, tiny: 100, thresholdPct: threshold })
    ).toBe("BREAK");
  });

  it("BREAK ganha precedência sobre MISSING_TINY", () => {
    expect(
      classifyDivergence({ declared: 50, committed: 60, tiny: null, thresholdPct: threshold })
    ).toBe("BREAK");
  });

  it("retorna MISSING_TINY quando tiny é null mas não há ruptura", () => {
    expect(
      classifyDivergence({ declared: 100, committed: 0, tiny: null, thresholdPct: threshold })
    ).toBe("MISSING_TINY");
  });

  it("retorna MISSING_TINY quando tiny é undefined", () => {
    expect(
      classifyDivergence({ declared: 100, committed: 0, tiny: undefined, thresholdPct: threshold })
    ).toBe("MISSING_TINY");
  });

  it("retorna MATCH quando tiny está dentro do threshold (10%)", () => {
    expect(
      classifyDivergence({ declared: 1000, committed: 500, tiny: 1050, thresholdPct: threshold })
    ).toBe("MATCH");
    expect(
      classifyDivergence({ declared: 1000, committed: 0, tiny: 1100, thresholdPct: threshold })
    ).toBe("MATCH");
  });

  it("retorna DIVERGE quando |tiny - declared| > threshold", () => {
    expect(
      classifyDivergence({ declared: 1000, committed: 0, tiny: 1200, thresholdPct: threshold })
    ).toBe("DIVERGE");
    expect(
      classifyDivergence({ declared: 100, committed: 0, tiny: 80, thresholdPct: threshold })
    ).toBe("DIVERGE");
  });

  it("usa GREATEST(1, declared) para evitar divisão por zero", () => {
    // declared=0, tiny=5 → diff = |5-0|/1 *100 = 500% > 10%
    expect(
      classifyDivergence({ declared: 0, committed: 0, tiny: 5, thresholdPct: threshold })
    ).toBe("DIVERGE");
    // declared=0, tiny=0 → diff = 0
    expect(
      classifyDivergence({ declared: 0, committed: 0, tiny: 0, thresholdPct: threshold })
    ).toBe("MATCH");
  });

  it("respeita threshold customizado", () => {
    // threshold 5% : 1000 vs 1040 = 4% → MATCH; 1000 vs 1060 = 6% → DIVERGE
    expect(
      classifyDivergence({ declared: 1000, committed: 0, tiny: 1040, thresholdPct: 5 })
    ).toBe("MATCH");
    expect(
      classifyDivergence({ declared: 1000, committed: 0, tiny: 1060, thresholdPct: 5 })
    ).toBe("DIVERGE");
  });
});

describe("currentReferenceMonth", () => {
  it("retorna YYYY-MM-01 em America/Sao_Paulo", () => {
    // 15 de janeiro 2026, 12:00 UTC = 09:00 SP → mês 2026-01
    const result = currentReferenceMonth(new Date("2026-01-15T12:00:00Z"));
    expect(result).toBe("2026-01-01");
  });

  it("trata virada de mês com cuidado de timezone", () => {
    // 01 de fevereiro 2026, 02:00 UTC = 31 de janeiro 23:00 SP → mês 2026-01
    const result = currentReferenceMonth(new Date("2026-02-01T02:00:00Z"));
    expect(result).toBe("2026-01-01");
  });

  it("sempre retorna o primeiro dia (01)", () => {
    const result = currentReferenceMonth(new Date("2026-12-25T15:00:00Z"));
    expect(result).toBe("2026-12-01");
  });
});
