import { describe, it, expect } from "vitest";
import { backfillMatchedClientTinyId } from "./congressos-sync.service";

/** Admin fake: consome `script` na ordem dos awaits; registra updates. */
function fakeAdmin(script: Array<{ data?: unknown; error?: unknown }>) {
  let i = 0;
  const next = () => script[i++] ?? { data: null, error: null };
  const updates: Array<{ table: string; payload: any }> = [];
  function builder(table: string) {
    const b: any = {
      select: () => b,
      update: (p: any) => {
        updates.push({ table, payload: p });
        return b;
      },
      eq: () => b,
      maybeSingle: () => Promise.resolve(next()),
      then: (res: any, rej: any) => Promise.resolve(next()).then(res, rej),
    };
    return b;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { admin: { from: (t: string) => builder(t) } as any, updates };
}

describe("backfillMatchedClientTinyId", () => {
  it("grava tiny_id quando o client casado ainda não tem", async () => {
    const f = fakeAdmin([{ error: null }]);
    const r = await backfillMatchedClientTinyId(f.admin, {
      clientId: "cid-1",
      registrationId: "reg-1",
      currentTinyId: null,
      currentOrigin: null,
      tinyId: 753739799,
      nowTs: "now",
    });
    expect(r).toEqual({ clientId: "cid-1", origin: null });
    expect(f.updates).toContainEqual({
      table: "clients",
      payload: { tiny_id: 753739799, tiny_synced_at: "now" },
    });
  });

  it("no-op quando já tem o mesmo tiny_id", async () => {
    const f = fakeAdmin([]);
    const r = await backfillMatchedClientTinyId(f.admin, {
      clientId: "cid-2",
      registrationId: "reg-2",
      currentTinyId: 753739799,
      currentOrigin: "o",
      tinyId: 753739799,
      nowTs: "now",
    });
    expect(r).toEqual({ clientId: "cid-2", origin: "o" });
    expect(f.updates).toHaveLength(0);
  });

  it("não sobrescreve quando o client já tem OUTRO tiny_id", async () => {
    const f = fakeAdmin([]);
    const r = await backfillMatchedClientTinyId(f.admin, {
      clientId: "cid-3",
      registrationId: "reg-3",
      currentTinyId: 111,
      currentOrigin: null,
      tinyId: 999,
      nowTs: "now",
    });
    expect(r).toEqual({ clientId: "cid-3", origin: null });
    expect(f.updates).toHaveLength(0);
  });

  it("conflito UNIQUE(tiny_id) → reconcilia: reaponta a registration para o client dono", async () => {
    const f = fakeAdmin([
      { error: { code: "23505", message: "duplicate clients_tiny_id_key" } }, // clients.update conflita
      { data: { id: "owner-1", origin: "loja" } }, // select do dono
      { error: null }, // event_registrations.update
    ]);
    const r = await backfillMatchedClientTinyId(f.admin, {
      clientId: "cid-dup",
      registrationId: "reg-4",
      currentTinyId: null,
      currentOrigin: null,
      tinyId: 753739799,
      nowTs: "now",
    });
    expect(r).toEqual({ clientId: "owner-1", origin: "loja" });
    expect(f.updates).toContainEqual({
      table: "event_registrations",
      payload: { matched_client_id: "owner-1" },
    });
  });
});
