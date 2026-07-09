/**
 * Verificação server-side do Cloudflare Turnstile.
 *
 * Fail-open: se `TURNSTILE_SECRET_KEY` não estiver configurado, a verificação é
 * liberada (com aviso) para não travar o pré-cadastro no estande. Quando o
 * secret está setado, o token é obrigatório e validado contra o Cloudflare.
 */
const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.warn(
      "[turnstile] TURNSTILE_SECRET_KEY ausente — verificação liberada (fail-open)."
    );
    return true;
  }

  if (!token) return false;

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (ip) body.set("remoteip", ip);

    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] erro na verificação:", err);
    return false;
  }
}
