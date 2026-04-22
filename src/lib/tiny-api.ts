import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/** Erro quando o refresh token do Tiny está expirado ou revogado (invalid_grant). */
export class TinyTokenExpiredError extends Error {
  constructor(message: string = "Sessão Tiny expirada ou revogada. Reconecte em Configurações > Integrações.") {
    super(message);
    this.name = "TinyTokenExpiredError";
  }
}

const TINY_TOKEN_URL =
  "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token";
const TINY_AUTH_URL =
  "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth";
// API V3 OAuth: URL correta é https://api.tiny.com.br/public-api/v3
// NÃO usar https://api.tiny.com.br/api3 (retorna 404 "sessão expirou")
const TINY_API_V3 = "https://api.tiny.com.br/public-api/v3";
function getTinyApiBase(): string {
  const env = process.env.TINY_API_URL?.trim();
  if (!env) return TINY_API_V3;
  if (env.includes("/api3") && !env.includes("public-api")) {
    console.warn(
      "[Tiny API] TINY_API_URL incorreta (api3). Usando public-api/v3."
    );
    return TINY_API_V3;
  }
  return env;
}

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function getTinyAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.TINY_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid",
  });
  return `${TINY_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(TINY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.TINY_CLIENT_ID!,
      client_secret: process.env.TINY_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tiny OAuth token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(TINY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.TINY_CLIENT_ID!,
      client_secret: process.env.TINY_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const body = JSON.parse(text) as { error?: string; error_description?: string };
      if (body?.error === "invalid_grant" || /token is not active|token.*inactive/i.test(body?.error_description ?? "")) {
        throw new TinyTokenExpiredError(
          body?.error_description ?? "Sessão Tiny expirada ou revogada. Reconecte em Configurações > Integrações."
        );
      }
    } catch (e) {
      if (e instanceof TinyTokenExpiredError) throw e;
    }
    throw new Error(`Tiny OAuth refresh failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function storeTinyTokens(tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}) {
  const supabase = getServiceClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase.from("app_settings").upsert({
    key: "tiny_oauth_tokens",
    value: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
    },
    updated_at: new Date().toISOString(),
  });
}

async function getValidAccessToken(): Promise<string> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "tiny_oauth_tokens")
    .single();

  if (error) {
    console.error("[Tiny API] Erro ao buscar tokens do banco:", error.message);
    throw new Error(`Erro ao buscar tokens: ${error.message}`);
  }

  if (!data?.value) {
    console.warn("[Tiny API] Nenhum token encontrado em app_settings");
    throw new TinyTokenExpiredError("Tiny ERP não conectado. Configure em Configurações > Integrações.");
  }

  const tokens = data.value as {
    access_token: string;
    refresh_token: string;
    expires_at: string;
  };

  if (!tokens.access_token || !tokens.refresh_token) {
    console.error("[Tiny API] access_token ou refresh_token ausente");
    throw new TinyTokenExpiredError("Token inválido. Reconecte o Tiny ERP em Configurações > Integrações.");
  }

  const now = new Date();
  const expiresAt = new Date(tokens.expires_at);
  const bufferMs = 60_000; // 1 min buffer

  if (now.getTime() + bufferMs < expiresAt.getTime()) {
    return tokens.access_token;
  }

  console.log("[Tiny API] Token expirado, renovando...");
  const refreshed = await refreshAccessToken(tokens.refresh_token);
  await storeTinyTokens(refreshed);
  return refreshed.access_token;
}

export async function tinyApiGet<T = any>(endpoint: string): Promise<T> {
  const token = await getValidAccessToken();
  const base = getTinyApiBase();
  const url = `${base}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  if (process.env.NODE_ENV !== "production") {
    console.log("[Tiny API] URL final:", url);
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await res.text();

  if (!res.ok) {
    console.error(
      "[Tiny API] Erro",
      res.status,
      res.statusText,
      "Body:",
      text.slice(0, 500)
    );
    throw new Error(`Tiny API GET ${endpoint} failed: ${res.status} ${text}`);
  }

  try {
    const data = JSON.parse(text);
    return data as T;
  } catch {
    console.error("[Tiny API] Resposta não é JSON válido:", text.slice(0, 300));
    throw new Error(`Tiny API retornou resposta inválida: ${text.slice(0, 200)}`);
  }
}

export async function tinyApiPost<T = any>(
  endpoint: string,
  body: unknown
): Promise<T> {
  const token = await getValidAccessToken();
  const base = getTinyApiBase();
  const url = `${base}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  if (process.env.NODE_ENV !== "production") {
    console.log("[Tiny API] URL final:", url);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tiny API POST ${endpoint} failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function tinyApiPatch<T = any>(
  endpoint: string,
  body: unknown
): Promise<T> {
  const token = await getValidAccessToken();
  const base = getTinyApiBase();
  const url = `${base}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tiny API PATCH ${endpoint} failed: ${res.status} ${text}`);
  }

  // 204 No Content is a valid success response for PATCH
  if (res.status === 204) return {} as T;
  return res.json();
}

export async function isTinyConnected(): Promise<boolean> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "tiny_oauth_tokens")
    .single();

  return !!data?.value;
}

/**
 * Remove tokens do Tiny (usado quando refresh falha ou ao desconectar).
 */
export async function clearTinyTokens(): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from("app_settings").delete().eq("key", "tiny_oauth_tokens");
}

/**
 * Refresh proativo: garante que o token está válido.
 * Se o refresh falhar (invalid_grant), remove os tokens.
 * Usado pelo cron diário para manter a conexão ativa.
 */
export async function refreshTinyTokenProactively(): Promise<{
  success: boolean;
  refreshed?: boolean;
  cleared?: boolean;
  skipped?: boolean;
  error?: string;
}> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "tiny_oauth_tokens")
    .single();

  if (!data?.value) {
    return { success: true, skipped: true };
  }

  try {
    await getValidAccessToken();
    return { success: true };
  } catch (e) {
    if (e instanceof TinyTokenExpiredError) {
      await clearTinyTokens();
      console.warn("[Tiny API] Token expirado, tokens removidos:", e.message);
      return { success: false, cleared: true, error: e.message };
    }
    throw e;
  }
}
