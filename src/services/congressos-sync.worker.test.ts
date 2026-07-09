import { describe, it, expect, vi, beforeEach } from "vitest";

const { adminHolder, createOrFindMock } = vi.hoisted(() => ({
  adminHolder: { current: null as any },
  createOrFindMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminHolder.current,
}));
vi.mock("@/lib/tiny/contacts", () => ({
  createOrFindTinyContact: createOrFindMock,
}));
vi.mock("@/lib/tiny-api", () => ({
  TinyTokenExpiredError: class TinyTokenExpiredError extends Error {},
}));

import { processCongressSyncJobs } from "./congressos-sync.service";

/** Admin fake: consome `script` na ordem dos awaits; registra updates/inserts. */
function createFakeAdmin(script: Array<{ data?: unknown; error?: unknown }>) {
  let i = 0;
  const next = () => script[i++] ?? { data: null, error: null };
  const updates: Array<{ table: string; payload: any }> = [];
  const inserts: Array<{ table: string; payload: any }> = [];

  function builder(table: string) {
    const b: any = {
      select: () => b,
      insert: (p: any) => {
        inserts.push({ table, payload: p });
        return b;
      },
      update: (p: any) => {
        updates.push({ table, payload: p });
        return b;
      },
      in: () => b,
      lte: () => b,
      gt: () => b,
      or: () => b,
      order: () => b,
      eq: () => b,
      limit: () => Promise.resolve(next()),
      maybeSingle: () => Promise.resolve(next()),
      single: () => Promise.resolve(next()),
      then: (res: any, rej: any) => Promise.resolve(next()).then(res, rej),
    };
    return b;
  }

  return { admin: { from: (t: string) => builder(t) }, updates, inserts };
}

function reg(overrides: Record<string, unknown> = {}) {
  return {
    id: "reg-1",
    edition_id: "ed-1",
    document: "07048665955",
    name: "Fulano",
    email: null,
    phone: null,
    contact_type: "CONSUMIDOR",
    qualified: false,
    matched_client_id: "cli-1",
    ...overrides,
  };
}

describe("processCongressSyncJobs — associação do tiny_id ao cliente casado", () => {
  beforeEach(() => createOrFindMock.mockReset());

  it("cliente casado SEM tiny_id: resolve via Tiny e grava clients.tiny_id", async () => {
    createOrFindMock.mockResolvedValue({ tiny_id: 753739799, found: true });
    const fake = createFakeAdmin([
      { data: [{ id: "job-1", registration_id: "reg-1", attempts: 0 }] },
      { error: null }, // PROCESSING
      { data: reg() }, // reg
      { data: { slug: "congresso-teste" } }, // edition
      { data: { id: "cli-1", tiny_id: null, origin: null } }, // client
      { error: null }, // backfill update
      { error: null }, // DONE
      { error: null }, // log
    ]);
    adminHolder.current = fake.admin;

    const res = await processCongressSyncJobs();

    expect(res.done).toBe(1);
    expect(createOrFindMock).toHaveBeenCalledTimes(1);
    const clientTinyUpdate = fake.updates.find(
      (u) => u.table === "clients" && "tiny_id" in u.payload
    );
    expect(clientTinyUpdate?.payload.tiny_id).toBe(753739799);
  });

  it("cliente casado que JÁ tem tiny_id (skip-Tiny): não chama Tiny nem re-grava", async () => {
    const fake = createFakeAdmin([
      { data: [{ id: "job-2", registration_id: "reg-2", attempts: 0 }] },
      { error: null }, // PROCESSING
      { data: reg({ id: "reg-2", matched_client_id: "cli-2" }) },
      { data: { slug: "congresso-teste" } },
      { data: { id: "cli-2", tiny_id: 753739799, origin: null } }, // já tem
      { error: null }, // DONE
      { error: null }, // log
    ]);
    adminHolder.current = fake.admin;

    const res = await processCongressSyncJobs();

    expect(res.done).toBe(1);
    expect(createOrFindMock).not.toHaveBeenCalled();
    expect(
      fake.updates.find((u) => u.table === "clients" && "tiny_id" in u.payload)
    ).toBeUndefined();
  });

  it("conflito UNIQUE(tiny_id) por duplicata: reaponta a registration para o client dono (não fica null)", async () => {
    createOrFindMock.mockResolvedValue({ tiny_id: 753739799, found: true });
    const fake = createFakeAdmin([
      { data: [{ id: "job-3", registration_id: "reg-3", attempts: 0 }] },
      { error: null }, // PROCESSING
      { data: reg({ id: "reg-3", matched_client_id: "cli-dup" }) },
      { data: { slug: "congresso-teste" } },
      { data: { id: "cli-dup", tiny_id: null, origin: null } }, // client casado (duplicata)
      { error: { code: "23505", message: "duplicate clients_tiny_id_key" } }, // backfill CONFLITA
      { data: { id: "owner-1", origin: null } }, // dono do tiny_id
      { error: null }, // reaponta registration
      { error: null }, // DONE
      { error: null }, // log
    ]);
    adminHolder.current = fake.admin;

    const res = await processCongressSyncJobs();

    expect(res.done).toBe(1);
    const repoint = fake.updates.find(
      (u) =>
        u.table === "event_registrations" && "matched_client_id" in u.payload
    );
    expect(repoint?.payload.matched_client_id).toBe("owner-1");
  });
});
