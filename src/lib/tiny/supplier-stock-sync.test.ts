import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractStock,
  fetchTinyStockForProduct,
  type TinyProductDetail,
} from "./supplier-stock-sync";

vi.mock("@/lib/tiny-api", () => ({
  tinyApiGet: vi.fn(),
}));

import { tinyApiGet } from "@/lib/tiny-api";

describe("extractStock", () => {
  it("lê estoque do root", () => {
    expect(extractStock({ estoque: 100 } as TinyProductDetail)).toBe(100);
    expect(extractStock({ saldo: 50 } as TinyProductDetail)).toBe(50);
  });

  it("lê estoque de data.* quando wrapper v3", () => {
    expect(extractStock({ data: { estoque: 200 } } as TinyProductDetail)).toBe(200);
    expect(extractStock({ data: { saldo: 25 } } as TinyProductDetail)).toBe(25);
  });

  it("parse string com vírgula/ponto retorna número", () => {
    expect(extractStock({ estoque: "150" } as TinyProductDetail)).toBe(150);
    expect(extractStock({ saldo: "12.5" } as TinyProductDetail)).toBe(12.5);
  });

  it("retorna 0 para valores ausentes", () => {
    expect(extractStock({} as TinyProductDetail)).toBe(0);
    expect(extractStock({ estoque: null as unknown as number } as TinyProductDetail)).toBe(0);
  });

  it("filtra por depósito quando depositoId é informado", () => {
    const raw: TinyProductDetail = {
      estoque: 999,
      depositos: [
        { idDeposito: 1, saldo: 100 },
        { idDeposito: 2, saldo: 250 },
      ],
    };
    expect(extractStock(raw, 1)).toBe(100);
    expect(extractStock(raw, 2)).toBe(250);
  });

  it("aceita campo `id` no depósito (formato alternativo Tiny)", () => {
    const raw: TinyProductDetail = {
      depositos: [
        { id: 7, estoque: 33 },
        { id: 8, estoque: 44 },
      ],
    };
    expect(extractStock(raw, 7)).toBe(33);
    expect(extractStock(raw, 8)).toBe(44);
  });

  it("cai no root quando depósito informado não está no array", () => {
    const raw: TinyProductDetail = {
      estoque: 500,
      depositos: [{ idDeposito: 1, saldo: 100 }],
    };
    expect(extractStock(raw, 999)).toBe(500);
  });
});

describe("fetchTinyStockForProduct", () => {
  beforeEach(() => {
    vi.mocked(tinyApiGet).mockReset();
  });

  it("busca estoque de cada variante mapeada no tiny_color_map", async () => {
    vi.mocked(tinyApiGet).mockImplementation(async (endpoint: string) => {
      if (endpoint === "/produtos/100") return { estoque: 50 };
      if (endpoint === "/produtos/200") return { estoque: 75 };
      throw new Error("unexpected " + endpoint);
    });

    const { results, errors } = await fetchTinyStockForProduct({
      tinyId: 999,
      tinyColorMap: {
        lilas: { tiny_id: 100 },
        amarela: { tiny_id: 200 },
      },
    });

    expect(errors).toEqual([]);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.colorKey === "lilas")?.stock).toBe(50);
    expect(results.find((r) => r.colorKey === "amarela")?.stock).toBe(75);
  });

  it("busca apenas o tiny_id pai quando não há cores mapeadas", async () => {
    vi.mocked(tinyApiGet).mockResolvedValue({ estoque: 196 });

    const { results, errors } = await fetchTinyStockForProduct({
      tinyId: 555,
      tinyColorMap: null,
    });

    expect(errors).toEqual([]);
    expect(results).toEqual([
      { tinyId: 555, stock: 196, colorKey: null, depositoId: null },
    ]);
  });

  it("ignora produto pai quando há variantes mapeadas", async () => {
    vi.mocked(tinyApiGet).mockResolvedValue({ estoque: 10 });

    const { results } = await fetchTinyStockForProduct({
      tinyId: 999,
      tinyColorMap: { lilas: { tiny_id: 100 } },
    });

    expect(tinyApiGet).toHaveBeenCalledTimes(1);
    expect(tinyApiGet).toHaveBeenCalledWith("/produtos/100");
    expect(results).toHaveLength(1);
    expect(results[0].colorKey).toBe("lilas");
  });

  it("captura erros por variante sem interromper o lote", async () => {
    vi.mocked(tinyApiGet).mockImplementation(async (endpoint: string) => {
      if (endpoint === "/produtos/100") return { estoque: 50 };
      if (endpoint === "/produtos/200") throw new Error("not found");
      throw new Error("unexpected " + endpoint);
    });

    const { results, errors } = await fetchTinyStockForProduct({
      tinyId: null,
      tinyColorMap: {
        ok: { tiny_id: 100 },
        broken: { tiny_id: 200 },
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0].colorKey).toBe("ok");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("200");
  });

  it("encaminha depositoId para extractStock por depósito", async () => {
    vi.mocked(tinyApiGet).mockResolvedValue({
      estoque: 999,
      depositos: [
        { idDeposito: 7, saldo: 88 },
        { idDeposito: 9, saldo: 1 },
      ],
    });

    const { results } = await fetchTinyStockForProduct({
      tinyId: 555,
      tinyColorMap: null,
      depositoId: 7,
    });

    expect(results[0].stock).toBe(88);
    expect(results[0].depositoId).toBe(7);
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
