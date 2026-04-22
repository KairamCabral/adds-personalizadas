import { NextRequest, NextResponse } from "next/server";
import { runIncrementalClientsSync } from "@/lib/tiny-sync-incremental";
import { isWithinBusinessHours } from "@/lib/business-hours";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Cron: sincronização incremental de contatos Tiny → CRM
 *
 * - Autenticação: Bearer CRON_SECRET (igual ao cleanup)
 * - Horário comercial: só executa em seg-sex 8h-18h (configurável via env)
 * - Processa até 5 páginas (500 contatos) por execução
 *
 * Configurar no Vercel Cron (vercel.json):
 *   "crons": [{ "path": "/api/cron/tiny-sync-incremental", "schedule": "0 9 * * 1-5" }]
 *
 * Env opcionais:
 *   TINY_SYNC_START_HOUR=8
 *   TINY_SYNC_END_HOUR=18
 *   TINY_SYNC_TIMEZONE=America/Sao_Paulo
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET não configurado - fail-closed");
    return NextResponse.json({ error: "Servidor não configurado" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  if (!force && !isWithinBusinessHours()) {
    return NextResponse.json({
      skipped: true,
      reason: "Fora do horário comercial",
      message:
        "Sync incremental só roda em horário comercial (seg-sex 8h-18h). Use ?force=1 para ignorar.",
    });
  }

  try {
    const result = await runIncrementalClientsSync();
    return NextResponse.json({
      success: result.success,
      synced: result.synced,
      pagesProcessed: result.pagesProcessed,
      earlyExit: result.earlyExit,
      nextOffset: result.nextOffset,
      message: result.message,
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error("[Tiny Sync Incremental] Erro:", e.message);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
