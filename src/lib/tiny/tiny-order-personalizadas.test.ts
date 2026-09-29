import { describe, expect, it } from "vitest";
import { isPersonalizadasOrder } from "@/lib/tiny/tiny-order-import";

describe("isPersonalizadasOrder", () => {
  // ── Casos que ANTES falhavam (regressão dos pedidos #17716/#17745) ──

  it("classifica por pagamento.categoria (Venda Dentistas Personalizadas)", () => {
    // Webhook real: sem categoria/marcadores no topo; a categoria vem no pagamento.
    const raw = {
      id: 921398898,
      deposito: { id: 7654321 }, // sem nome — a forma que a checagem antiga não pegava
      pagamento: {
        formaPagamento: "Pix",
        categoria: { id: 42, descricao: "Venda Dentistas Personalizadas" },
      },
      itens: [{ item: { produto: { id: 1, codigo: "ESC-XYZ" } }, quantidade: 10 }],
    };
    const r = isPersonalizadasOrder(raw);
    expect(r.isPersonalizadas).toBe(true);
    expect(r.reason).toContain("pagamento");
  });

  it("classifica por nome do depósito (SP - WS Serviços - Personaliz)", () => {
    const raw = {
      id: 1,
      deposito: { id: 99, nome: "SP - WS Serviços - Personaliz" },
      itens: [],
    };
    expect(isPersonalizadasOrder(raw).isPersonalizadas).toBe(true);
  });

  it("classifica por SKU de item com prefixo PERS- (mesmo sem tag/categoria)", () => {
    const raw = {
      id: 921392610,
      itens: [
        { item: { produto: { id: 2, codigo: "PERS-ESC-ADDS-IMPLANT-AMARELO" } }, quantidade: 24 },
      ],
    };
    const r = isPersonalizadasOrder(raw);
    expect(r.isPersonalizadas).toBe(true);
    expect(r.reason).toContain("PERS-ESC-ADDS-IMPLANT-AMARELO");
  });

  it("reconhece SKU personalizado no formato de item não aninhado (sku direto)", () => {
    const raw = {
      id: 3,
      itens: [{ sku: "pers_escova_custom", quantidade: 5 }],
    };
    expect(isPersonalizadasOrder(raw).isPersonalizadas).toBe(true);
  });

  // ── Comportamento existente preservado ──

  it("mantém a classificação por tag (marcadores)", () => {
    const raw = {
      id: 4,
      marcadores: [{ nome: "1ª venda" }, { nome: "personalizadas" }],
      itens: [],
    };
    const r = isPersonalizadasOrder(raw);
    expect(r.isPersonalizadas).toBe(true);
    expect(r.reason).toBe(`tag="personalizadas"`);
  });

  it("mantém a classificação por categoria de topo (string)", () => {
    expect(
      isPersonalizadasOrder({ id: 5, categoria: "Vendas Personalizadas", itens: [] })
        .isPersonalizadas
    ).toBe(true);
  });

  // ── Negativos: não classificar pedido comum como personalizada ──

  it("NÃO classifica pedido comum (depósito/categoria/SKU sem 'personaliz')", () => {
    const raw = {
      id: 6,
      deposito: { id: 10, nome: "SP - Marketplace" },
      pagamento: { formaPagamento: "Boleto", categoria: { descricao: "Venda Marketplace" } },
      itens: [{ item: { produto: { id: 3, codigo: "ESC-ADDS-PRO-CLEAN" } }, quantidade: 12 }],
    };
    const r = isPersonalizadasOrder(raw);
    expect(r.isPersonalizadas).toBe(false);
    expect(r.reason).toBe("nenhum critério bateu");
  });

  it("NÃO confunde SKU que apenas contém 'pers' no meio (ex.: DISPERSANTE)", () => {
    const raw = {
      id: 7,
      itens: [{ item: { produto: { id: 4, codigo: "DISPERSANTE-500" } }, quantidade: 3 }],
    };
    // Prefixo /^PERS[-_]/ não bate e "dispersante" não contém "personaliz".
    expect(isPersonalizadasOrder(raw).isPersonalizadas).toBe(false);
  });
});
