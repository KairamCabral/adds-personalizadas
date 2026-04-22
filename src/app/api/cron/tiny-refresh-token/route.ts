import { NextRequest, NextResponse } from "next/server";
import { refreshTinyTokenProactively } from "@/lib/tiny-api";
import { safeCompare } from "@/lib/crypto-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Cron: refresh proativo do token Tiny
 *
 * - Autenticação: Bearer CRON_SECRET (igual aos outros crons)
 * - Executa 1x por dia (ex: 6h) para manter o token válido
 * - Se o refresh falhar (token expirado), remove os tokens
 *
 * Configurar no Vercel Cron (vercel.json):
 *   "crons": [{ "path": "/api/cron/tiny-refresh-token", "schedule": "0 6 * * *" }]
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET não configurado - fail-closed");
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization") ?? "";
  if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await refreshTinyTokenProactively();
    return NextResponse.json(result);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error("[Tiny Refresh Token] Erro:", e.message);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
