import { describe, it, expect, vi } from "vitest";
import { backfillMatchedClientTinyId } from "./congressos-sync.service";

/** Mock mínimo do admin client: from("clients").update({...}).eq("id", id) → { error }. */
function mockAdmin(result: { error: unknown }) {
  const eq = vi.fn().mockResolvedValue(result);
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { admin: { from } as any, from, update, eq };
}

describe("backfillMatchedClientTinyId", () => {
  it("grava tiny_id no client casado quando ainda não tem (caminho fallback → write)", async () => {
    const m = mockAdmin({ error: null });
    await backfillMatchedClientTinyId(
      m.admin,
      "cid-1",
      null,
      753739799,
      "2026-07-08T00:00:00Z"
    );
    expect(m.from).toHaveBeenCalledWith("clients");
    expect(m.update).toHaveBeenCalledWith({
      tiny_id: 753739799,
      tiny_synced_at: "2026-07-08T00:00:00Z",
    });
    expect(m.eq).toHaveBeenCalledWith("id", "cid-1");
  });

  it("não falha o job quando o UNIQUE(tiny_id) conflita (duplicata de documento)", async () => {
    const m = mockAdmin({
      error: {
        code: "23505",
        message:
          "duplicate key value violates unique constraint clients_tiny_id_key",
      },
    });
    await expect(
      backfillMatchedClientTinyId(m.admin, "cid-2", null, 753739799, "now")
    ).resolves.toBeUndefined();
    expect(m.update).toHaveBeenCalledTimes(1);
  });

  it("não sobrescreve quando o client já tem OUTRO tiny_id", async () => {
    const m = mockAdmin({ error: null });
    await backfillMatchedClientTinyId(m.admin, "cid-3", 111, 999, "now");
    expect(m.update).not.toHaveBeenCalled();
  });

  it("no-op quando já tem o mesmo tiny_id", async () => {
    const m = mockAdmin({ error: null });
    await backfillMatchedClientTinyId(
      m.admin,
      "cid-4",
      753739799,
      753739799,
      "now"
    );
    expect(m.update).not.toHaveBeenCalled();
  });
});
