/**
 * Fan-out de webhooks do Tiny para sistemas externos (ex: NI — Notificações Inteligentes).
 * Fire-and-forget: não bloqueia a resposta ao Tiny.
 */

export interface ForwardResult {
  status: "success" | "failed" | "timeout" | "skipped";
  http_code: number | null;
  error: string | null;
}

const FORWARD_TIMEOUT_MS = 3000;

// Headers que NÃO devem ser repassados (fetch recalcula ou são específicos do hop)
const HEADERS_TO_STRIP = new Set([
  "host",
  "content-length",
  "connection",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  "x-vercel-id",
  "x-vercel-deployment-url",
  "x-vercel-forwarded-for",
  "cf-connecting-ip",
  "cf-ray",
]);

export async function forwardToNI(params: {
  rawBody: string;
  originalHeaders: Record<string, string>;
}): Promise<ForwardResult> {
  const url = process.env.NI_WEBHOOK_URL;

  if (!url) {
    return {
      status: "skipped",
      http_code: null,
      error: "NI_WEBHOOK_URL not configured",
    };
  }

  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(params.originalHeaders)) {
    const lowerKey = key.toLowerCase();
    if (!HEADERS_TO_STRIP.has(lowerKey)) {
      forwardHeaders[key] = value;
    }
  }
  forwardHeaders["x-forwarded-by"] = "adds-crm";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: forwardHeaders,
      body: params.rawBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      return { status: "success", http_code: res.status, error: null };
    }

    const errorText = await res.text().catch(() => "");
    return {
      status: "failed",
      http_code: res.status,
      error: errorText.slice(0, 500) || `HTTP ${res.status}`,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === "AbortError") {
      return {
        status: "timeout",
        http_code: null,
        error: `Timeout após ${FORWARD_TIMEOUT_MS}ms`,
      };
    }

    const msg =
      err instanceof Error ? err.message : String(err ?? "unknown error");
    return {
      status: "failed",
      http_code: null,
      error: msg.slice(0, 500),
    };
  }
}
