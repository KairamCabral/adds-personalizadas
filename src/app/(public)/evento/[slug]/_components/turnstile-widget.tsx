"use client";

import { Turnstile } from "@marsidev/react-turnstile";

/**
 * true quando o Turnstile está configurado (site key presente). Quando true, o
 * fluxo exige o token antes de concluir; quando false, mantém-se o fail-open.
 */
export const TURNSTILE_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
);

/**
 * Widget Cloudflare Turnstile. Se `NEXT_PUBLIC_TURNSTILE_SITE_KEY` não estiver
 * configurado, não renderiza nada (fail-open — o servidor libera a verificação).
 */
export function TurnstileWidget({
  onToken,
}: {
  onToken: (token: string | null) => void;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <div className="flex justify-center">
      <Turnstile
        siteKey={siteKey}
        onSuccess={(token) => onToken(token)}
        onExpire={() => onToken(null)}
        onError={() => onToken(null)}
        options={{ theme: "light", size: "flexible" }}
      />
    </div>
  );
}
