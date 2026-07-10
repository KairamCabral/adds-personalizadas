import { describe, it, expect } from "vitest";
import {
  evaluateQueueAlert,
  type QueueCounts,
  DEAD_THRESHOLD,
  DISPATCH_FAILED_THRESHOLD,
  SYNC_FAILED_WARN,
  BACKLOG_WARN,
} from "./queue-health";

function counts(overrides?: {
  sync?: Partial<QueueCounts["sync"]>;
  dispatch?: Partial<QueueCounts["dispatch"]>;
}): QueueCounts {
  return {
    sync: {
      pending: 0,
      processing: 0,
      failed: 0,
      dead: 0,
      done: 0,
      ...overrides?.sync,
    },
    dispatch: {
      pendente: 0,
      enviado: 0,
      falhou: 0,
      cancelado: 0,
      ...overrides?.dispatch,
    },
  };
}

describe("evaluateQueueAlert", () => {
  it("ok quando tudo está saudável", () => {
    const r = evaluateQueueAlert(
      counts({ sync: { done: 100, pending: 2 }, dispatch: { enviado: 100 } })
    );
    expect(r.level).toBe("ok");
    expect(r.messages).toHaveLength(0);
  });

  it("critical quando há job de sync morto (>= limiar)", () => {
    const r = evaluateQueueAlert(counts({ sync: { dead: DEAD_THRESHOLD } }));
    expect(r.level).toBe("critical");
    expect(r.messages.some((m) => m.includes("morto"))).toBe(true);
  });

  it("critical quando há e-mail falho (>= limiar)", () => {
    const r = evaluateQueueAlert(
      counts({ dispatch: { falhou: DISPATCH_FAILED_THRESHOLD } })
    );
    expect(r.level).toBe("critical");
    expect(r.messages.some((m) => m.toLowerCase().includes("e-mail"))).toBe(
      true
    );
  });

  it("warn quando há retry de sync acima do limiar, sem mortos", () => {
    const r = evaluateQueueAlert(counts({ sync: { failed: SYNC_FAILED_WARN } }));
    expect(r.level).toBe("warn");
    expect(r.messages.some((m) => m.includes("retry"))).toBe(true);
  });

  it("warn quando o backlog de pendentes (pending+processing) cruza o limiar", () => {
    const r = evaluateQueueAlert(
      counts({ sync: { pending: BACKLOG_WARN - 1, processing: 1 } })
    );
    expect(r.level).toBe("warn");
    expect(r.messages.some((m) => m.includes("pendentes"))).toBe(true);
  });

  it("critical prevalece sobre warn e lista as críticas primeiro", () => {
    const r = evaluateQueueAlert(
      counts({ sync: { dead: 3, failed: SYNC_FAILED_WARN } })
    );
    expect(r.level).toBe("critical");
    expect(r.messages[0]).toContain("morto");
    expect(r.messages.length).toBeGreaterThanOrEqual(2);
  });

  it("não dispara abaixo do limiar", () => {
    const r = evaluateQueueAlert(
      counts({ sync: { failed: SYNC_FAILED_WARN - 1, pending: BACKLOG_WARN - 1 } })
    );
    expect(r.level).toBe("ok");
  });
});
