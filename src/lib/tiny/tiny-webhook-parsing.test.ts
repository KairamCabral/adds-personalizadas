import { describe, expect, it } from "vitest";
import { parseTinyPayloadFromRawBody } from "@/lib/tiny/process-webhook-notification";
import { mapTinySituacaoToCrmStatus } from "@/lib/tiny/tiny-order-import";

describe("mapTinySituacaoToCrmStatus", () => {
  it("mapeia códigos numéricos da API Tiny", () => {
    expect(mapTinySituacaoToCrmStatus(0)).toBe("FAZER");
    expect(mapTinySituacaoToCrmStatus(1)).toBe("FINALIZADO");
    expect(mapTinySituacaoToCrmStatus(3)).toBe("CONFIRMACAO");
    expect(mapTinySituacaoToCrmStatus(2)).toBe("ARQUIVADO");
    expect(mapTinySituacaoToCrmStatus(6)).toBe("FINALIZADO");
  });

  it("mapeia labels em português do webhook", () => {
    expect(mapTinySituacaoToCrmStatus("Em aberto")).toBe("FAZER");
    expect(mapTinySituacaoToCrmStatus("Aprovado")).toBe("CONFIRMACAO");
    expect(mapTinySituacaoToCrmStatus("Faturado")).toBe("FINALIZADO");
    expect(mapTinySituacaoToCrmStatus("faturado")).toBe("FINALIZADO");
  });
});

describe("parseTinyPayloadFromRawBody", () => {
  it("parseia application/x-www-form-urlencoded", () => {
    const raw =
      "tipo=pedido&dados=" +
      encodeURIComponent(JSON.stringify({ id: 12345, situacao: "Em aberto" }));
    const { payload } = parseTinyPayloadFromRawBody(
      raw,
      "application/x-www-form-urlencoded"
    );
    expect(payload?.tipo).toBe("pedido");
    expect(payload?.dados.id).toBe(12345);
  });

  it("parseia JSON com dados objeto", () => {
    const raw = JSON.stringify({
      tipo: "pedido",
      dados: { id: 99, situacao: "3" },
    });
    const { payload } = parseTinyPayloadFromRawBody(raw, "application/json");
    expect(payload?.tipo).toBe("pedido");
    expect(payload?.dados.id).toBe(99);
  });

  it("parseia JSON mesmo quando o Content-Type não é application/json (caso Tiny real)", () => {
    const raw = JSON.stringify({
      tipo: "pedido",
      dados: { id: 555, situacao: "Em aberto" },
    });
    const { payload } = parseTinyPayloadFromRawBody(
      raw,
      "text/plain; charset=utf-8"
    );
    expect(payload?.tipo).toBe("pedido");
    expect(payload?.dados.id).toBe(555);
  });
});
