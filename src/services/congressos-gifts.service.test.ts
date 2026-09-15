import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Regressão de um bug que chegou em produção: os RPCs ainda não tipados eram
 * chamados via `const rpc = supabase.rpc; rpc(...)`. Isso DESANEXA o método e
 * perde o `this` — o corpo do supabase-js faz `return this.rest.rpc(...)` e
 * estoura TypeError em runtime. O build e o tsc passavam sem reclamar.
 *
 * O fake abaixo registra se `rpc` foi invocado como método do client.
 */
const { fakeClient, calls } = vi.hoisted(() => {
  const calls: Array<{ fn: string; args: unknown; boundToClient: boolean }> =
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
    from: () => ({}),
  };
  return { fakeClient: client, calls };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => fakeClient,
}));

import { issueGiftConfirmCode, redeemGift } from "./congressos-gifts.service";

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
