import { describe, expect, it } from "vitest";
import {
  computeTinyOrderHash,
  mergeItemsPreservingPersonalization,
} from "./tiny-order-resync";

describe("mergeItemsPreservingPersonalization", () => {
  type FreshLike = {
    product_id: string | null;
    color: string | null;
    personalization: Record<string, unknown> | null;
    quantity: number;
  };

  it("retorna fresh inalterado quando não existe nada no CRM", () => {
    const fresh: FreshLike[] = [
      {
        product_id: "p1",
        color: "amarelo",
        personalization: { colors: ["amarelo"], custom_color: null },
        quantity: 5,
      },
    ];
    const merged = mergeItemsPreservingPersonalization(fresh, []);
    expect(merged).toEqual(fresh);
  });

  it("preserva custom_color do CRM quando casa por (product_id, color)", () => {
    const fresh: FreshLike[] = [
      {
        product_id: "p1",
        color: "amarelo",
        personalization: { colors: ["amarelo"], custom_color: null },
        quantity: 8,
      },
    ];
    const existing = [
      {
        product_id: "p1",
        color: "amarelo",
        personalization: {
          colors: ["amarelo"],
          custom_color: "Roxo personalizado",
          notes: "Cuidado com brilho",
        },
      },
    ];

    const merged = mergeItemsPreservingPersonalization(fresh, existing);

    expect(merged[0].personalization).toMatchObject({
      colors: ["amarelo"],
      custom_color: "Roxo personalizado",
      notes: "Cuidado com brilho",
    });
    // Quantidade segue Tiny
    expect(merged[0].quantity).toBe(8);
  });

  it("preserva apenas notes quando só notes estão no CRM", () => {
    const fresh: FreshLike[] = [
      {
        product_id: "p1",
        color: "verde",
        personalization: { colors: ["verde"], custom_color: null },
        quantity: 3,
      },
    ];
    const existing = [
      {
        product_id: "p1",
        color: "verde",
        personalization: { colors: ["verde"], notes: "Logotipo dourado" },
      },
    ];

    const merged = mergeItemsPreservingPersonalization(fresh, existing);

    expect(merged[0].personalization).toMatchObject({
      colors: ["verde"],
      notes: "Logotipo dourado",
    });
  });

  it("não casa quando a cor mudou no Tiny — item entra fresh", () => {
    const fresh: FreshLike[] = [
      {
        product_id: "p1",
        color: "verde",
        personalization: { colors: ["verde"], custom_color: null },
        quantity: 3,
      },
    ];
    const existing = [
      {
        product_id: "p1",
        color: "amarelo",
        personalization: {
          colors: ["amarelo"],
          custom_color: "Especial",
          notes: "Old note",
        },
      },
    ];

    const merged = mergeItemsPreservingPersonalization(fresh, existing);

    expect(merged[0].personalization).toMatchObject({
      colors: ["verde"],
      custom_color: null,
    });
    expect((merged[0].personalization as Record<string, unknown>).notes).toBeUndefined();
  });

  it("ignora itens existentes que sumiram do Tiny (caller deleta)", () => {
    const fresh: FreshLike[] = [
      {
        product_id: "p1",
        color: "amarelo",
        personalization: { colors: ["amarelo"], custom_color: null },
        quantity: 1,
      },
    ];
    const existing = [
      {
        product_id: "p1",
        color: "amarelo",
        personalization: { colors: ["amarelo"], notes: "ok" },
      },
      // Esse some no Tiny
      {
        product_id: "p2",
        color: "lilas",
        personalization: { colors: ["lilas"], custom_color: "rosa" },
      },
    ];

    const merged = mergeItemsPreservingPersonalization(fresh, existing);

    expect(merged).toHaveLength(1);
    expect((merged[0].personalization as Record<string, unknown>).notes).toBe("ok");
    // O item p2 não retorna — o caller faz delete-then-insert do array merged
  });

  it("não sobrescreve campos não-CRM (ex: colors)", () => {
    const fresh: FreshLike[] = [
      {
        product_id: "p1",
        color: "verde",
        personalization: { colors: ["verde"], custom_color: null },
        quantity: 1,
      },
    ];
    const existing = [
      {
        product_id: "p1",
        color: "verde",
        // Existing tem colors errado (residual de migração) — não deve vazar
        personalization: { colors: ["verde-incorreto"], notes: "manter" },
      },
    ];

    const merged = mergeItemsPreservingPersonalization(fresh, existing);

    expect((merged[0].personalization as Record<string, unknown>).colors).toEqual([
      "verde",
    ]);
    expect((merged[0].personalization as Record<string, unknown>).notes).toBe(
      "manter"
    );
  });

  it("não confunde product_ids null com casamento universal", () => {
    const fresh: FreshLike[] = [
      {
        product_id: null,
        color: null,
        personalization: null,
        quantity: 1,
      },
    ];
    const existing = [
      {
        product_id: "p1",
        color: "amarelo",
        personalization: { custom_color: "x" },
      },
    ];

    const merged = mergeItemsPreservingPersonalization(fresh, existing);

    // Sem casamento: fresh sai como veio
    expect(merged[0].personalization).toBeNull();
  });
});

describe("computeTinyOrderHash", () => {
  const baseRaw: Record<string, unknown> = {
    id: 917640756,
    cliente: {
      id: 761172830,
      nome: "Radaelli Odontologia",
      tipoPessoa: "J",
      cpfCnpj: "08073503000107",
      email: "x@y.com",
      endereco: {
        endereco: "Rua Ivo José Rebello",
        numero: "610",
        bairro: "Santa Regina",
        municipio: "Camboriú",
        uf: "SC",
        cep: "88345900",
      },
    },
    situacao: 3,
    itens: [
      {
        item: {
          produto: { id: 1, sku: "PRD00011A" },
          quantidade: 8,
          valorUnitario: 0.01,
        },
      },
      {
        item: {
          produto: { id: 2, sku: "PRD00011L" },
          quantidade: 8,
          valorUnitario: 0.01,
        },
      },
    ],
  };

  it("é determinístico — mesmo input gera mesmo hash", () => {
    expect(computeTinyOrderHash(baseRaw)).toBe(computeTinyOrderHash(baseRaw));
  });

  it("muda quando o CNPJ muda", () => {
    const a = computeTinyOrderHash(baseRaw);
    const b = computeTinyOrderHash({
      ...baseRaw,
      cliente: { ...(baseRaw.cliente as object), cpfCnpj: "11111111000111" },
    });
    expect(a).not.toBe(b);
  });

  it("muda quando o endereço muda", () => {
    const cliente = baseRaw.cliente as Record<string, unknown>;
    const a = computeTinyOrderHash(baseRaw);
    const b = computeTinyOrderHash({
      ...baseRaw,
      cliente: {
        ...cliente,
        endereco: {
          ...(cliente.endereco as object),
          numero: "999",
        },
      },
    });
    expect(a).not.toBe(b);
  });

  it("muda quando quantidade de item muda", () => {
    const a = computeTinyOrderHash(baseRaw);
    const b = computeTinyOrderHash({
      ...baseRaw,
      itens: [
        {
          item: {
            produto: { id: 1, sku: "PRD00011A" },
            quantidade: 99,
            valorUnitario: 0.01,
          },
        },
        (baseRaw.itens as unknown[])[1],
      ],
    });
    expect(a).not.toBe(b);
  });

  it("é estável quando itens vêm em ordem diferente", () => {
    const itensOriginal = baseRaw.itens as unknown[];
    const reordered = [...itensOriginal].reverse();
    const a = computeTinyOrderHash(baseRaw);
    const b = computeTinyOrderHash({ ...baseRaw, itens: reordered });
    expect(a).toBe(b);
  });

  it("ignora chaves voláteis irrelevantes (timestamps internos, marcadores)", () => {
    const a = computeTinyOrderHash(baseRaw);
    const b = computeTinyOrderHash({
      ...baseRaw,
      dataAlteracao: "2026-05-05T12:00:00",
      marcadores: [{ nome: "personalizadas" }],
      ecommerce: { id: 1234, plataforma: "Tiny" },
    });
    expect(a).toBe(b);
  });

  it("muda quando situacao muda (ex: aprovado → faturado)", () => {
    const a = computeTinyOrderHash(baseRaw);
    const b = computeTinyOrderHash({ ...baseRaw, situacao: 1 });
    expect(a).not.toBe(b);
  });

  it("aceita itens sem aninhamento `item`", () => {
    const flatItens = [
      { produto: { id: 1, sku: "X" }, quantidade: 1, valorUnitario: 1 },
      { produto: { id: 2, sku: "Y" }, quantidade: 2, valorUnitario: 2 },
    ];
    const nestedItens = [
      { item: { produto: { id: 1, sku: "X" }, quantidade: 1, valorUnitario: 1 } },
      { item: { produto: { id: 2, sku: "Y" }, quantidade: 2, valorUnitario: 2 } },
    ];
    const a = computeTinyOrderHash({ ...baseRaw, itens: flatItens });
    const b = computeTinyOrderHash({ ...baseRaw, itens: nestedItens });
    expect(a).toBe(b);
  });
});
