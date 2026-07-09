import { NextRequest, NextResponse } from "next/server";
import { safeCompare } from "@/lib/crypto-utils";
import { processCongressSyncJobs } from "@/services/congressos-sync.service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/congress-sync] CRON_SECRET não configurado - fail-closed");
    return NextResponse.json(
      { error: "CRON_SECRET não configurado" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await processCongressSyncJobs();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[cron/congress-sync]", err);
    return NextResponse.json(
      { error: "Erro ao processar sync de congressos" },
      { status: 500 }
    );
  }
}
