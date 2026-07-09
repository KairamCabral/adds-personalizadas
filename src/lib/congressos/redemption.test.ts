import { describe, it, expect, vi } from "vitest";

// `redemption.ts` importa o admin client só pelo tipo (nunca o executa). O mock
// evita puxar o supabase-js real e segue o padrão dos testes irmãos do módulo.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

import {
  fetchRedemption,
  createRedemption,
  ensureRedemption,
} from "./redemption";

/** Admin fake: consome `script` na ordem dos awaits; registra inserts. */
function createFakeAdmin(script: Array<{ data?: unknown; error?: unknown }>) {
  let i = 0;
  const next = () => script[i++] ?? { data: null, error: null };
  const inserts: Array<{ table: string; payload: any }> = [];

  function builder(table: string) {
    const b: any = {
      select: () => b,
      insert: (p: any) => {
        inserts.push({ table, payload: p });
        return b;
      },
      eq: () => b,
      maybeSingle: () => Promise.resolve(next()),
      single: () => Promise.resolve(next()),
    };
    return b;
  }

  return { admin: { from: (t: string) => builder(t) } as any, inserts };
}

const REDEMPTION = { token: "tok-abc", short_code: "123456" };
const redemptionInserts = (fake: ReturnType<typeof createFakeAdmin>) =>
  fake.inserts.filter((i) => i.table === "event_gift_redemptions");

describe("ensureRedemption — janela de corrida (dedup → nunca 500)", () => {
  it("registration corrida SEM redemption ainda: cria e retorna", async () => {
    const fake = createFakeAdmin([
      { data: null }, // fetchRedemption → ainda não existe
      { data: REDEMPTION }, // createRedemption insert → sucesso
    ]);

    const red = await ensureRedemption(fake.admin, "ed-1", "reg-1");

    expect(red).toEqual(REDEMPTION);
    expect(redemptionInserts(fake)[0]?.payload).toMatchObject({
      edition_id: "ed-1",
      registration_id: "reg-1",
    });
  });

  it("redemption já existe: retorna a existente sem inserir (idempotente)", async () => {
    const fake = createFakeAdmin([
      { data: REDEMPTION }, // fetchRedemption → já existe
    ]);

    const red = await ensureRedemption(fake.admin, "ed-1", "reg-1");

    expect(red).toEqual(REDEMPTION);
    expect(redemptionInserts(fake)).toHaveLength(0);
  });

  it("outro request cria a redemption no meio (23505 no registration_id): dedup para a existente", async () => {
    const fake = createFakeAdmin([
      { data: null }, // fetchRedemption inicial → nenhuma
      { error: { code: "23505" } }, // insert colide (o vencedor já criou)
      { data: REDEMPTION }, // fetch dentro do createRedemption → existente
    ]);

    const red = await ensureRedemption(fake.admin, "ed-1", "reg-1");

    expect(red).toEqual(REDEMPTION);
  });
});

describe("createRedemption — colisão de short_code", () => {
  it("23505 de short_code (sem redemption existente): tenta outro código e conclui", async () => {
    const fake = createFakeAdmin([
      { error: { code: "23505" } }, // insert 1: colide short_code
      { data: null }, // fetchRedemption → não é redemption existente
      { data: REDEMPTION }, // insert 2: novo short_code → sucesso
    ]);

    const red = await createRedemption(fake.admin, "ed-1", "reg-1");

    expect(red).toEqual(REDEMPTION);
    expect(redemptionInserts(fake)).toHaveLength(2);
  });
});

describe("fetchRedemption", () => {
  it("sem redemption: retorna null", async () => {
    const fake = createFakeAdmin([{ data: null }]);
    expect(await fetchRedemption(fake.admin, "reg-x")).toBeNull();
  });
});
