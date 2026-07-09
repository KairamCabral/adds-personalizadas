/**
 * Rate limiter + retry para chamadas à API do Tiny (V3).
 *
 * O `tiny-api.ts` faz `fetch` direto, sem throttle. No worker de sync de
 * congressos (drena a fila `tiny_contact_sync_jobs` no pico do evento)
 * precisamos limitar a vazão para não estourar o Tiny. Espelha
 * `src/lib/bling/rate-limiter.ts`: fila singleton in-memory ~2 req/s + retry
 * exponencial em 429.
 *
 * LIMITAÇÃO: in-memory por instância serverless. Como o worker roda num único
 * cron (uma instância), o agregado é respeitado; o retry cobre eventuais 429.
 */
const RATE_LIMIT_INTERVAL_MS = 500; // ~2 req/seg
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

type QueuedRequest<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retriesLeft: number;
};

class TinyRateLimiter {
  private queue: QueuedRequest<unknown>[] = [];
  private isProcessing = false;
  private lastRequestAt = 0;

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: QueuedRequest<T> = {
        fn,
        resolve,
        reject,
        retriesLeft: MAX_RETRIES,
      };
      this.queue.push(item as QueuedRequest<unknown>);
      this.scheduleProcess();
    });
  }

  private scheduleProcess() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    void this.processNext();
  }

  private async processNext(): Promise<void> {
    const item = this.queue.shift();
    if (!item) {
      this.isProcessing = false;
      return;
    }

    const elapsed = Date.now() - this.lastRequestAt;
    const waitNeeded = Math.max(0, RATE_LIMIT_INTERVAL_MS - elapsed);
    if (waitNeeded > 0) await sleep(waitNeeded);
    this.lastRequestAt = Date.now();

    try {
      const result = await withTimeout(item.fn(), REQUEST_TIMEOUT_MS);
      item.resolve(result);
    } catch (err) {
      const retried = await this.maybeRetry(item, err);
      if (!retried) {
        item.reject(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      void this.processNext();
    }
  }

  private async maybeRetry(
    item: QueuedRequest<unknown>,
    err: unknown
  ): Promise<boolean> {
    if (!isRateLimitError(err) || item.retriesLeft <= 0) return false;
    const attemptIndex = MAX_RETRIES - item.retriesLeft;
    await sleep(RETRY_DELAYS_MS[attemptIndex] ?? 4_000);
    this.queue.unshift({ ...item, retriesLeft: item.retriesLeft - 1 });
    return true;
  }
}

const limiter = new TinyRateLimiter();

/** Use sempre para chamadas ao Tiny dentro do worker (throttle ~2 req/s + retry 429). */
export function enqueueTinyRequest<T>(fn: () => Promise<T>): Promise<T> {
  return limiter.enqueue(fn);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`[tiny-rate-limiter] timeout após ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === "object" && "status" in err) {
    if ((err as { status: unknown }).status === 429) return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("429") ||
      msg.includes("too many requests") ||
      msg.includes("limite de requisi")
    );
  }
  return false;
}
