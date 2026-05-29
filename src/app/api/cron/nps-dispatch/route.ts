import { NextRequest, NextResponse } from "next/server";

import { safeCompare } from "@/lib/crypto-utils";
import { processNpsDispatches } from "@/services/nps.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/nps-dispatch] CRON_SECRET não configurado - fail-closed");
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await processNpsDispatches();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[cron/nps-dispatch]", err);
    return NextResponse.json({ error: "Erro ao processar disparos NPS" }, { status: 500 });
  }
}
