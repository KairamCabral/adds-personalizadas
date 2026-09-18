import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regressão de um bug que chegou em produção: os RPCs ainda não tipados eram
 * chamados via `const rpc = supabase.rpc; rpc(...)`. Isso DESANEXA o método e
 * perde o `this` — o corpo do supabase-js faz `return this.rest.rpc(...)` e
 * estoura TypeError em runtime. O build e o tsc passavam sem reclamar.
 *
 * O fake abaixo registra se `rpc` foi invocado como método do client.
 */
const { fakeClient, calls, queries } = vi.hoisted(() => {
  const calls: Array<{ fn: string; args: unknown; boundToClient: boolean }> =
    [];
  /** Cada `.from()` registra a tabela e os filtros aplicados na cadeia. */
  const queries: Array<{ table: string; filters: Array<[string, unknown[]]> }> =
    [];
  const client = {
    __isSupabaseClient: true,
    rpc(this: unknown, fn: string, args: unknown) {
      calls.push({
        fn,
        args,
        boundToClient:
          (this as { __isSupabaseClient?: boolean } | undefined)
            ?.__isSupabaseClient === true,
      });
      return Promise.resolve({ data: [], error: null });
    },
    from(table: string) {
      const q = { table, filters: [] as Array<[string, unknown[]]> };
      queries.push(q);
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "or", "ilike", "order", "limit"]) {
        b[m] = (...args: unknown[]) => {
          q.filters.push([m, args]);
          return b;
        };
      }
      b.then = (res: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(res);
      return b;
    },
  };
  return { fakeClient: client, calls, queries };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => fakeClient,
}));

import {
  issueGiftConfirmCode,
  redeemGift,
  searchGiftForRedeem,
} from "./congressos-gifts.service";

describe("busca no balcão", () => {
  beforeEach(() => {
    queries.length = 0;
  });

  const orDoTelefone = () =>
    queries
      .flatMap((q) => q.filters)
      .find(([m]) => m === "or")?.[1][0] as string | undefined;

  it("monta o filtro: digitado como 'contém', variantes como 'começa com'", async () => {
    await searchGiftForRedeem("ed-1", "489916");
    // Sintaxe do PostgREST: `coluna.like.*x*` (contém) e `coluna.like.x*`
    // (começa com), separados por vírgula. Um erro aqui quebra a busca por
    // telefone sem nenhum aviso.
    expect(orDoTelefone()).toBe(
      "phone_digits.like.*489916*,phone_digits.like.4899916*,phone_digits.like.48916*"
    );
  });

  it("6 dígitos consultam código E telefone (antes só o código)", async () => {
    await searchGiftForRedeem("ed-1", "489916");
    const codigo = queries.some((q) =>
      q.filters.some(([m, a]) => m === "eq" && a[0] === "short_code")
    );
    expect(codigo).toBe(true);
    expect(orDoTelefone()).toBeDefined();
  });

  it("nome não dispara busca por telefone", async () => {
    await searchGiftForRedeem("ed-1", "Maysa");
    expect(orDoTelefone()).toBeUndefined();
  });
});

describe("RPCs de congressos preservam o `this` do client", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("issueGiftConfirmCode chama rpc como método do client", async () => {
    await issueGiftConfirmCode("tok-123");
    const call = calls.find((c) => c.fn === "issue_gift_confirm_code");
    expect(call).toBeDefined();
    expect(call?.boundToClient).toBe(true);
    expect(call?.args).toEqual({ p_token: "tok-123" });
  });

  it("redeemGift chama rpc como método e repassa o código", async () => {
    await redeemGift("tok-456", "4821");
    const call = calls.find((c) => c.fn === "redeem_gift");
    expect(call).toBeDefined();
    expect(call?.boundToClient).toBe(true);
    expect(call?.args).toEqual({
      p_token: "tok-456",
      p_confirm_code: "4821",
    });
  });

  it("redeemGift sem código manda p_confirm_code null", async () => {
    await redeemGift("tok-789");
    const call = calls.find((c) => c.fn === "redeem_gift");
    expect(call?.args).toEqual({ p_token: "tok-789", p_confirm_code: null });
  });
});
