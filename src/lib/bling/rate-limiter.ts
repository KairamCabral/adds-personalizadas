/**
 * Rate Limiter + Retry Exponencial para chamadas à API do Bling.
 *
 * PROBLEMA: Bling permite 3 req/seg. Múltiplas chamadas em sequência (sendOrderToBling
 * que faz contato + busca + pedido) estouram facilmente o limite, gerando 429.
 *
 * SOLUÇÃO:
 *   - Fila singleton in-memory que processa no máximo 2 req/seg (margem de segurança)
 *   - Retry automático em 429 com backoff exponencial (1s, 2s, 4s)
 *   - Timeout de 30s por request pra evitar fila travada
 *
 * USO:
 *   const res = await enqueueBlingRequest(() =>
 *     fetch("https://api.bling.com.br/Api/v3/contatos", { ... })
 *   );
 *
 * LIMITAÇÃO CONHECIDA:
 *   In-memory por instância serverless. Se a Vercel rodar 2+ instâncias paralelas,
 *   cada uma respeita 2/seg, mas o agregado pode passar. O retry pega esses casos.
 *   Pro volume atual da ADDS é suficiente. Se crescer, migrar pra Redis (Upstash).
 */

const RATE_LIMIT_INTERVAL_MS = 500; // 2 req/seg
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000]; // backoff exponencial

type QueuedRequest<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retriesLeft: number;
  enqueuedAt: number;
  label: string; // pra logs
};

class BlingRateLimiter {
  private queue: QueuedRequest<unknown>[] = [];
  private isProcessing = false;
  private lastRequestAt = 0;
  private requestCounter = 0;

  /**
   * Enfileira uma função que faz request ao Bling.
   * Resolve com o resultado da função, ou rejeita após MAX_RETRIES tentativas em 429.
   */
  enqueue<T>(fn: () => Promise<T>, label = "bling-request"): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: QueuedRequest<T> = {
        fn,
        resolve,
        reject,
        retriesLeft: MAX_RETRIES,
        enqueuedAt: Date.now(),
        label,
      };
      this.queue.push(item as QueuedRequest<unknown>);
      console.log(
        `[bling-rate-limiter] enqueued (${this.queue.length} pending): ${label}`
      );
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

    // Garante intervalo mínimo entre requisições
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    const waitNeeded = Math.max(0, RATE_LIMIT_INTERVAL_MS - elapsed);
    if (waitNeeded > 0) {
      await sleep(waitNeeded);
    }

    this.lastRequestAt = Date.now();
    const requestId = ++this.requestCounter;
    const queueWaitMs = this.lastRequestAt - item.enqueuedAt;

    console.log(
      `[bling-rate-limiter] #${requestId} executing: ${item.label} (waited ${queueWaitMs}ms in queue)`
    );

    try {
      // Timeout protetivo
      const result = await withTimeout(item.fn(), REQUEST_TIMEOUT_MS, item.label);
      const wasRetry = item.retriesLeft < MAX_RETRIES;
      console.log(
        `[bling-rate-limiter] #${requestId} success${wasRetry ? " (after retry)" : ""}: ${item.label}`
      );
      item.resolve(result);
    } catch (err) {
      const handled = await this.handleError(item, err, requestId);
      if (!handled) {
        // Erro definitivo — propaga
        item.reject(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      // Continua processando próximo item
      void this.processNext();
    }
  }

  /**
   * Retorna true se o item foi re-enfileirado pra retry.
   * Retorna false se o erro deve propagar pro caller.
   */
  private async handleError(
    item: QueuedRequest<unknown>,
    err: unknown,
    requestId: number
  ): Promise<boolean> {
    const is429 = isRateLimitError(err);

    if (!is429) {
      console.log(
        `[bling-rate-limiter] #${requestId} non-429 error, propagating: ${item.label}`,
        err instanceof Error ? err.message : err
      );
      return false;
    }

    if (item.retriesLeft <= 0) {
      console.warn(
        `[bling-rate-limiter] #${requestId} retries exhausted for: ${item.label}`
      );
      return false;
    }

    const attemptIndex = MAX_RETRIES - item.retriesLeft;
    const delayMs = RETRY_DELAYS_MS[attemptIndex] ?? 4_000;
    console.warn(
      `[bling-rate-limiter] #${requestId} got 429, retrying in ${delayMs}ms (attempt ${attemptIndex + 1}/${MAX_RETRIES}): ${item.label}`
    );

    await sleep(delayMs);

    // Re-enfileira no INÍCIO da fila pra preservar ordem aproximada
    this.queue.unshift({
      ...item,
      retriesLeft: item.retriesLeft - 1,
      enqueuedAt: Date.now(),
    });

    return true;
  }

  /** Status pra debug (opcional). */
  getStatus() {
    return {
      pendingInQueue: this.queue.length,
      isProcessing: this.isProcessing,
      lastRequestAt: this.lastRequestAt,
      totalProcessed: this.requestCounter,
    };
  }
}

// Singleton — uma única fila por instância serverless
const limiter = new BlingRateLimiter();

/**
 * API pública. Use sempre essa função em vez de chamar fetch direto pro Bling.
 */
export function enqueueBlingRequest<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<T> {
  return limiter.enqueue(fn, label);
}

export function getBlingQueueStatus() {
  return limiter.getStatus();
}

// ════════════════════════════════════════════════
// HELPERS INTERNOS
// ════════════════════════════════════════════════

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`[bling-rate-limiter] timeout after ${timeoutMs}ms: ${label}`)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Detecta se um erro é rate limit (429) do Bling.
 * Inspeciona Response objects (com .status === 429) e Error com mensagem contendo "429" / "TOO_MANY_REQUESTS".
 */
function isRateLimitError(err: unknown): boolean {
  // Caso 1: a fn retornou um Response e o caller jogou — vamos olhar ele
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status: unknown }).status;
    if (status === 429) return true;
  }

  // Caso 2: Error com mensagem que indica 429
  if (err instanceof Error) {
    const msg = err.message;
    if (
      msg.includes("429") ||
      msg.includes("TOO_MANY_REQUESTS") ||
      msg.toLowerCase().includes("too many requests") ||
      msg.toLowerCase().includes("limite de requisições")
    ) {
      return true;
    }
  }

  return false;
}
