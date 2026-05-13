import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchTinyStockForProduct, pickDepositoSaldo } from "./supplier-stock-sync";

vi.mock("@/lib/tiny-api", () => ({
  tinyApiGet: vi.fn(),
}));

import { tinyApiGet } from "@/lib/tiny-api";

const lilasPayload = {
  id: 809742525,
  nome: "Implant - Lilás",
  codigo: "ESC-ADDS-IMPLANT-EM-1",
  saldo: 5512,
  reservado: 2637,
  disponivel: 2875,
  depositos: [
    { id: 917790637, nome: "Full Mercado Livre", desconsiderar: true, saldo: 0, reservado: 0, disponivel: 0, empresa: "adds" },
    { id: 798872182, nome: "SC - Sede ADDS", desconsiderar: false, saldo: 3315, reservado: 1019, disponivel: 2296, empresa: "adds" },
    { id: 809766089, nome: "SP - WS Servições - MarketPlac", desconsiderar: false, saldo: 922, reservado: 393, disponivel: 529, empresa: "adds" },
    { id: 809509624, nome: "SP - WS Servições - Personaliz", desconsiderar: false, saldo: 1275, reservado: 1225, disponivel: 50, empresa: "adds" },
  ],
};

describe("fetchTinyStockForProduct", () => {
  beforeEach(() => {
    vi.mocked(tinyApiGet).mockReset();
  });

  it("retorna saldos por depósito para variantes mapeadas", async () => {
    vi.mocked(tinyApiGet).mockImplementation(async (endpoint: string) => {
      if (endpoint === "/estoque/809742525") return lilasPayload;
      throw new Error("unexpected " + endpoint);
    });

    const { results, errors } = await fetchTinyStockForProduct({
      tinyId: 803889813,
      tinyColorMap: { lilas: { tiny_id: 809742525, sku: "ESC-ADDS-IMPLANT-EM-1" } },
    });

    expect(errors).toEqual([]);
    expect(results).toHaveLength(1);
    expect(results[0].tinyId).toBe(809742525);
    expect(results[0].colorKey).toBe("lilas");
    expect(results[0].totalSaldo).toBe(5512);
    expect(results[0].totalReservado).toBe(2637);
    expect(results[0].totalDisponivel).toBe(2875);
    expect(results[0].depositos).toHaveLength(4);
  });

  it("aceita payload envelopado em { data: ... }", async () => {
    vi.mocked(tinyApiGet).mockResolvedValue({ data: lilasPayload });
    const { results } = await fetchTinyStockForProduct({
      tinyId: null,
      tinyColorMap: { lilas: { tiny_id: 809742525 } },
    });
    expect(results[0].totalSaldo).toBe(5512);
  });

  it("marca desconsiderar=true para Full Mercado Livre", async () => {
    vi.mocked(tinyApiGet).mockResolvedValue(lilasPayload);
    const { results } = await fetchTinyStockForProduct({
      tinyId: null,
      tinyColorMap: { lilas: { tiny_id: 809742525 } },
    });
    const fullMl = results[0].depositos.find((d) => d.id === 917790637);
    expect(fullMl?.desconsiderar).toBe(true);
    const wsPers = results[0].depositos.find((d) => d.id === 809509624);
    expect(wsPers?.desconsiderar).toBe(false);
  });

  it("trata 404 (produto inexistente) sem quebrar lote", async () => {
    vi.mocked(tinyApiGet).mockImplementation(async (endpoint: string) => {
      if (endpoint === "/estoque/100") return lilasPayload;
      if (endpoint === "/estoque/999")
        throw new Error("Tiny API GET /estoque/999 failed: 404 not found");
      throw new Error("unexpected");
    });

    const { results, errors } = await fetchTinyStockForProduct({
      tinyId: null,
      tinyColorMap: {
        ok: { tiny_id: 100 },
        gone: { tiny_id: 999 },
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0].colorKey).toBe("ok");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("gone");
  });

  it("busca pelo tiny_id pai quando não há cores mapeadas", async () => {
    vi.mocked(tinyApiGet).mockResolvedValue(lilasPayload);
    const { results } = await fetchTinyStockForProduct({
      tinyId: 555,
      tinyColorMap: null,
    });
    expect(results).toHaveLength(1);
    expect(results[0].colorKey).toBeNull();
    expect(results[0].tinyId).toBe(555);
  });

  it("retorna vazio quando não há tiny_id nem variantes", async () => {
    const { results, errors } = await fetchTinyStockForProduct({
      tinyId: null,
      tinyColorMap: {},
    });
    expect(results).toEqual([]);
    expect(errors).toEqual([]);
    expect(tinyApiGet).not.toHaveBeenCalled();
  });
});

describe("pickDepositoSaldo", () => {
  const result = {
    tinyId: 1,
    colorKey: "lilas",
    totalSaldo: 0,
    totalReservado: 0,
    totalDisponivel: 0,
    depositos: [
      { id: 100, nome: "A", desconsiderar: false, saldo: 50, reservado: 10, disponivel: 40, empresa: "x" },
      { id: 200, nome: "B", desconsiderar: false, saldo: 30, reservado: 5, disponivel: 25, empresa: "x" },
    ],
  };

  it("retorna o depósito específico", () => {
    expect(pickDepositoSaldo(result, 100)?.saldo).toBe(50);
    expect(pickDepositoSaldo(result, 200)?.saldo).toBe(30);
  });

  it("retorna null quando depositoId não está na lista", () => {
    expect(pickDepositoSaldo(result, 999)).toBeNull();
  });

  it("retorna null quando depositoId é null", () => {
    expect(pickDepositoSaldo(result, null)).toBeNull();
    expect(pickDepositoSaldo(result, undefined)).toBeNull();
  });
});
