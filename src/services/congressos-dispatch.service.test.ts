import { describe, it, expect, vi, beforeEach } from "vitest";

const { adminHolder, channelHolder, sendMock } = vi.hoisted(() => ({
  adminHolder: { current: null as any },
  channelHolder: { current: null as any },
  sendMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminHolder.current,
}));
vi.mock("@/lib/congressos/channels", () => ({
  resolveChannel: () => channelHolder.current,
}));

import { processCongressDispatches } from "./congressos-dispatch.service";

/** Admin fake: consome `script` na ordem dos awaits; registra updates. */
function createFakeAdmin(script: Array<{ data?: unknown; error?: unknown }>) {
  let i = 0;
  const next = () => script[i++] ?? { data: null, error: null };
  const updates: Array<{ table: string; payload: any }> = [];

  function builder(table: string) {
    const b: any = {
      select: () => b,
      insert: () => b,
      update: (p: any) => {
        updates.push({ table, payload: p });
        return b;
      },
      in: () => b,
      lte: () => b,
      order: () => b,
      eq: () => b,
      limit: () => Promise.resolve(next()),
      maybeSingle: () => Promise.resolve(next()),
      single: () => Promise.resolve(next()),
      then: (res: any, rej: any) => Promise.resolve(next()).then(res, rej),
    };
    return b;
  }

  return { admin: { from: (t: string) => builder(t) }, updates };
}

function channel(overrides: Record<string, unknown> = {}) {
  return {
    channel: "EMAIL",
    isConfigured: () => true,
    send: sendMock,
    ...overrides,
  };
}

function dispatchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "disp-1",
    registration_id: "reg-1",
    channel: "EMAIL",
    recipient: "participante@example.com",
    attempts: 0,
    ...overrides,
  };
}

function reg(overrides: Record<string, unknown> = {}) {
  return { id: "reg-1", name: "Fulano de Tal", edition_id: "ed-1", ...overrides };
}

const edition = { name: "Congresso Teste", gift_name: "Squeeze" };
const redemption = { token: "tok-abc", short_code: "123456" };

const dispatchUpdate = (updates: Array<{ table: string; payload: any }>) =>
  updates.find(
    (u) => u.table === "event_dispatches" && "status" in u.payload
  );

describe("processCongressDispatches", () => {
  beforeEach(() => {
    sendMock.mockReset();
    channelHolder.current = channel();
  });

  it("envia com sucesso: claim → ENVIADO com sent_at", async () => {
    sendMock.mockResolvedValue({ success: true, providerId: "re_1" });
    const fake = createFakeAdmin([
      { data: [dispatchRow()] }, // due
      { data: { id: "disp-1" } }, // claim
      { data: reg() }, // registration
      { data: edition }, // edition
      { data: redemption }, // redemption
      { data: null }, // credit (sem cashback)
      { error: null }, // ENVIADO
    ]);
    adminHolder.current = fake.admin;

    const res = await processCongressDispatches();

    expect(res.sent).toBe(1);
    expect(res.processed).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const upd = dispatchUpdate(fake.updates);
    expect(upd?.payload.status).toBe("ENVIADO");
    expect(upd?.payload.sent_at).toBeTruthy();
    // a mensagem carrega token + short_code (nunca documento)
    expect(sendMock.mock.calls[0][0]).toMatchObject({
      giftToken: "tok-abc",
      shortCode: "123456",
      participantFirstName: "Fulano",
    });
  });

  it("canal não configurado: FALHOU terminal, sem enviar", async () => {
    channelHolder.current = channel({ isConfigured: () => false });
    const fake = createFakeAdmin([
      { data: [dispatchRow()] }, // due
      { data: { id: "disp-1" } }, // claim
      { error: null }, // FALHOU
    ]);
    adminHolder.current = fake.admin;

    const res = await processCongressDispatches();

    expect(res.dead).toBe(1);
    expect(res.sent).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
    expect(dispatchUpdate(fake.updates)?.payload.status).toBe("FALHOU");
  });

  it("sem destinatário: FALHOU terminal", async () => {
    const fake = createFakeAdmin([
      { data: [dispatchRow({ recipient: null })] }, // due
      { data: { id: "disp-1" } }, // claim
      { error: null }, // FALHOU
    ]);
    adminHolder.current = fake.admin;

    const res = await processCongressDispatches();

    expect(res.dead).toBe(1);
    expect(sendMock).not.toHaveBeenCalled();
    expect(dispatchUpdate(fake.updates)?.payload.send_error).toBe(
      "Sem destinatário"
    );
  });

  it("falha transitória (attempts < MAX): segue PENDENTE para retry", async () => {
    sendMock.mockResolvedValue({ success: false, error: "timeout Resend" });
    const fake = createFakeAdmin([
      { data: [dispatchRow({ attempts: 0 })] }, // due
      { data: { id: "disp-1" } }, // claim
      { data: reg() }, // registration
      { data: edition }, // edition
      { data: redemption }, // redemption
      { data: null }, // credit (sem cashback)
      { error: null }, // markFailure
    ]);
    adminHolder.current = fake.admin;

    const res = await processCongressDispatches();

    expect(res.failed).toBe(1);
    expect(res.dead).toBe(0);
    const upd = dispatchUpdate(fake.updates);
    expect(upd?.payload.status).toBe("PENDENTE");
    expect(upd?.payload.send_error).toBe("timeout Resend");
  });

  it("falha na última tentativa (attempts atinge MAX): FALHOU/dead", async () => {
    sendMock.mockResolvedValue({ success: false, error: "500 Resend" });
    const fake = createFakeAdmin([
      { data: [dispatchRow({ attempts: 4 })] }, // due (nextAttempts = 5 = MAX)
      { data: { id: "disp-1" } }, // claim
      { data: reg() }, // registration
      { data: edition }, // edition
      { data: redemption }, // redemption
      { data: null }, // credit (sem cashback)
      { error: null }, // markFailure
    ]);
    adminHolder.current = fake.admin;

    const res = await processCongressDispatches();

    expect(res.dead).toBe(1);
    expect(res.failed).toBe(0);
    expect(dispatchUpdate(fake.updates)?.payload.status).toBe("FALHOU");
  });

  it("claim perdido (corrida): não envia nem conta como processado", async () => {
    const fake = createFakeAdmin([
      { data: [dispatchRow()] }, // due
      { data: null }, // claim retorna 0 linhas
    ]);
    adminHolder.current = fake.admin;

    const res = await processCongressDispatches();

    expect(res.processed).toBe(0);
    expect(res.sent).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("fila vazia: retorna zeros", async () => {
    const fake = createFakeAdmin([{ data: [] }]);
    adminHolder.current = fake.admin;

    const res = await processCongressDispatches();

    expect(res).toEqual({ processed: 0, sent: 0, failed: 0, dead: 0 });
  });
});
