import { describe, expect, it } from "vitest";
import {
  isTinySituacaoAberto,
  isTinySituacaoCancelado,
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

describe("isTinySituacaoAberto", () => {
  it("aceita códigos 0 e 8 (Em aberto)", () => {
    expect(isTinySituacaoAberto(0)).toBe(true);
    expect(isTinySituacaoAberto("0")).toBe(true);
    expect(isTinySituacaoAberto(8)).toBe(true);
    expect(isTinySituacaoAberto("8")).toBe(true);
  });

  it("aceita rótulo 'Em aberto' (case/acento-insensitive)", () => {
    expect(isTinySituacaoAberto("Em aberto")).toBe(true);
    expect(isTinySituacaoAberto("em aberto")).toBe(true);
    expect(isTinySituacaoAberto("EM ABERTO")).toBe(true);
    expect(isTinySituacaoAberto("Aberto")).toBe(true);
  });

  it("não trata Aprovado/Faturado/Cancelado/Entregue como aberto", () => {
    expect(isTinySituacaoAberto(1)).toBe(false);
    expect(isTinySituacaoAberto(3)).toBe(false);
    expect(isTinySituacaoAberto(6)).toBe(false);
    expect(isTinySituacaoAberto(2)).toBe(false);
    expect(isTinySituacaoAberto("Aprovado")).toBe(false);
  });

  it("trata null/undefined/'' como não-aberto", () => {
    expect(isTinySituacaoAberto(null)).toBe(false);
    expect(isTinySituacaoAberto(undefined)).toBe(false);
    expect(isTinySituacaoAberto("")).toBe(false);
  });
});

describe("isTinySituacaoCancelado", () => {
  it("aceita código 2 (Tiny: Cancelado)", () => {
    expect(isTinySituacaoCancelado(2)).toBe(true);
    expect(isTinySituacaoCancelado("2")).toBe(true);
  });

  it("aceita rótulo em pt-br (case/acento-insensitive)", () => {
    expect(isTinySituacaoCancelado("Cancelado")).toBe(true);
    expect(isTinySituacaoCancelado("cancelado")).toBe(true);
    expect(isTinySituacaoCancelado("CANCELADO")).toBe(true);
    expect(isTinySituacaoCancelado("Cancelada")).toBe(true);
  });

  it("não trata outras situações como cancelado", () => {
    expect(isTinySituacaoCancelado(0)).toBe(false);
    expect(isTinySituacaoCancelado(1)).toBe(false);
    expect(isTinySituacaoCancelado(3)).toBe(false);
    expect(isTinySituacaoCancelado(6)).toBe(false);
    expect(isTinySituacaoCancelado("Em aberto")).toBe(false);
    expect(isTinySituacaoCancelado("Aprovado")).toBe(false);
    expect(isTinySituacaoCancelado("Faturado")).toBe(false);
    expect(isTinySituacaoCancelado("Entregue")).toBe(false);
  });

  it("trata null/undefined/'' como não-cancelado", () => {
    expect(isTinySituacaoCancelado(null)).toBe(false);
    expect(isTinySituacaoCancelado(undefined)).toBe(false);
    expect(isTinySituacaoCancelado("")).toBe(false);
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
