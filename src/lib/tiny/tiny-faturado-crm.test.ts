import { describe, expect, it } from "vitest";
import { isTinySituacaoEntregue, isTinySituacaoFaturado } from "./tiny-faturado-crm";

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

describe("isTinySituacaoEntregue", () => {
  it("aceita código 6 (Tiny: entregue)", () => {
    expect(isTinySituacaoEntregue(6)).toBe(true);
    expect(isTinySituacaoEntregue("6")).toBe(true);
  });

  it("aceita rótulo em português", () => {
    expect(isTinySituacaoEntregue("entregue")).toBe(true);
    expect(isTinySituacaoEntregue("Entregue")).toBe(true);
  });

  it("não confunde com faturado (1) ou fazer (0)", () => {
    expect(isTinySituacaoEntregue(1)).toBe(false);
    expect(isTinySituacaoEntregue(0)).toBe(false);
  });
});
