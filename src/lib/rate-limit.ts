const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  windowMs: number; // Janela de tempo em ms
  max: number; // Máximo de requests na janela
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): { success: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  // Limpar entradas expiradas periodicamente
  if (rateLimitMap.size > 10000) {
    for (const [k, v] of rateLimitMap) {
      if (v.resetAt < now) rateLimitMap.delete(k);
    }
  }

  if (!record || record.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + config.windowMs });
    return { success: true, remaining: config.max - 1 };
  }

  if (record.count >= config.max) {
    return { success: false, remaining: 0 };
  }

  record.count++;
  return { success: true, remaining: config.max - record.count };
}

export function rateLimitResponse() {
  return new Response(
    JSON.stringify({
      error: "Muitas requisições. Tente novamente em alguns minutos.",
    }),
    { status: 429, headers: { "Content-Type": "application/json" } }
  );
}
