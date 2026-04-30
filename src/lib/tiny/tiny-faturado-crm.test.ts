import { describe, expect, it } from "vitest";
import {
  isTinySituacaoEntregue,
  isTinySituacaoFaturado,
  isTinySituacaoPago,
} from "./tiny-faturado-crm";

describe("isTinySituacaoPago", () => {
  it("aceita código 1 (Faturado)", () => {
    expect(isTinySituacaoPago(1)).toBe(true);
    expect(isTinySituacaoPago("1")).toBe(true);
  });

  it("aceita código 3 (Aprovado) — pago no Tiny gera NF automaticamente", () => {
    expect(isTinySituacaoPago(3)).toBe(true);
    expect(isTinySituacaoPago("3")).toBe(true);
  });

  it("aceita rótulos em pt-br para Aprovado e Faturado", () => {
    expect(isTinySituacaoPago("Aprovado")).toBe(true);
    expect(isTinySituacaoPago("aprovado")).toBe(true);
    expect(isTinySituacaoPago("Aprovada")).toBe(true);
    expect(isTinySituacaoPago("Faturado")).toBe(true);
    expect(isTinySituacaoPago("FATURADO")).toBe(true);
    expect(isTinySituacaoPago("autorizada")).toBe(true);
  });

  it("não trata Em aberto / Cancelado / Entregue como pago", () => {
    expect(isTinySituacaoPago("Em aberto")).toBe(false);
    expect(isTinySituacaoPago(0)).toBe(false);
    expect(isTinySituacaoPago("Cancelado")).toBe(false);
    expect(isTinySituacaoPago(2)).toBe(false);
    // Entregue (6) é tratado pelo gatilho derivado em quem chama isTinySituacaoPago.
    // Aqui ainda retorna false — quem chama precisa unir com isTinySituacaoEntregue.
    expect(isTinySituacaoPago(6)).toBe(false);
  });
});

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
