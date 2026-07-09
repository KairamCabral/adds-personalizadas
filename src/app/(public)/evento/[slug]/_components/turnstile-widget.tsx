"use client";

import { Turnstile } from "@marsidev/react-turnstile";

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
