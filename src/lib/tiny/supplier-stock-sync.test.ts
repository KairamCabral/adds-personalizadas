import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractStock,
  fetchTinyStockForProduct,
} from "./supplier-stock-sync";

vi.mock("@/lib/tiny-api", () => ({
  tinyApiGet: vi.fn(),
}));

import { tinyApiGet } from "@/lib/tiny-api";

describe("extractStock", () => {
  it("lê estoque do root", () => {
    expect(extractStock({ estoque: 100 } as never)).toBe(100);
    expect(extractStock({ saldo: 50 } as never)).toBe(50);
  });

  it("lê estoque de data.* quando wrapper v3", () => {
    expect(extractStock({ data: { estoque: 200 } } as never)).toBe(200);
  });

  it("retorna 0 quando campo ausente", () => {
    expect(extractStock({} as never)).toBe(0);
  });
});

describe("fetchTinyStockForProduct", () => {
  beforeEach(() => {
    vi.mocked(tinyApiGet).mockReset();
  });

  it("busca estoque por SKU (listagem) para cada cor mapeada", async () => {
    vi.mocked(tinyApiGet).mockImplementation(async (endpoint: string) => {
      if (endpoint.includes("codigo=SKU-LIL"))
        return { itens: [{ id: 100, codigo: "SKU-LIL", estoque: 50 }] };
      if (endpoint.includes("codigo=SKU-AMA"))
        return { itens: [{ id: 200, codigo: "SKU-AMA", estoque: 75 }] };
      throw new Error("unexpected " + endpoint);
    });

    const { results, errors } = await fetchTinyStockForProduct({
      tinyId: 999,
      tinyColorMap: {
        lilas: { tiny_id: 100, sku: "SKU-LIL" },
        amarela: { tiny_id: 200, sku: "SKU-AMA" },
      },
    });

    expect(errors).toEqual([]);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.colorKey === "lilas")?.stock).toBe(50);
    expect(results.find((r) => r.colorKey === "amarela")?.stock).toBe(75);
  });

  it("aceita estoque vindo dentro de data.itens", async () => {
    vi.mocked(tinyApiGet).mockResolvedValue({
      data: { itens: [{ id: 100, codigo: "SKU-LIL", saldo: 88 }] },
    });

    const { results } = await fetchTinyStockForProduct({
      tinyId: 999,
      tinyColorMap: { lilas: { tiny_id: 100, sku: "SKU-LIL" } },
    });

    expect(results[0].stock).toBe(88);
  });

  it("usa fallback /produtos/{id} se a listagem por SKU não retorna estoque", async () => {
    vi.mocked(tinyApiGet).mockImplementation(async (endpoint: string) => {
      if (endpoint.includes("codigo=SKU-LIL")) return { itens: [] };
      if (endpoint === "/produtos/100") return { estoque: 42 };
      throw new Error("unexpected " + endpoint);
    });

    const { results } = await fetchTinyStockForProduct({
      tinyId: 999,
      tinyColorMap: { lilas: { tiny_id: 100, sku: "SKU-LIL" } },
    });

    expect(results[0].stock).toBe(42);
  });

  it("registra erro quando não encontra estoque em nenhum caminho", async () => {
    vi.mocked(tinyApiGet).mockImplementation(async (endpoint: string) => {
      if (endpoint.includes("codigo=SKU-XYZ")) return { itens: [] };
      if (endpoint === "/produtos/300") return { id: 300, nome: "..." }; // sem estoque
      throw new Error("unexpected " + endpoint);
    });

    const { results, errors } = await fetchTinyStockForProduct({
      tinyId: null,
      tinyColorMap: { broken: { tiny_id: 300, sku: "SKU-XYZ" } },
    });

    expect(results).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("broken");
  });

  it("busca pelo tiny_id pai quando não há cores mapeadas", async () => {
    vi.mocked(tinyApiGet).mockResolvedValue({ estoque: 196 });

    const { results, errors } = await fetchTinyStockForProduct({
      tinyId: 555,
      tinyColorMap: null,
    });

    expect(errors).toEqual([]);
    expect(results).toEqual([{ tinyId: 555, stock: 196, colorKey: null }]);
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
