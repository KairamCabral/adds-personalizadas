import { describe, expect, it } from "vitest";
import { isTinySituacaoFaturado } from "./tiny-faturado-crm";

describe("isTinySituacaoFaturado", () => {
  it("aceita código numérico 1 (Tiny: Faturado)", () => {
    expect(isTinySituacaoFaturado(1)).toBe(true);
    expect(isTinySituacaoFaturado("1")).toBe(true);
  });

  it("aceita rótulo em minúsculas (Olist / webhooks)", () => {
    expect(isTinySituacaoFaturado("faturado")).toBe(true);
    expect(isTinySituacaoFaturado("FATURADO")).toBe(true);
  });

  it("não trata aprovado / em aberto como faturado", () => {
    expect(isTinySituacaoFaturado("Aprovado")).toBe(false);
    expect(isTinySituacaoFaturado("Em aberto")).toBe(false);
    expect(isTinySituacaoFaturado(3)).toBe(false);
  });
});
