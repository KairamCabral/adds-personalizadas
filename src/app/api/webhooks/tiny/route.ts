/**
 * Webhook Tiny ERP (URL alternativa com ?token=)
 *
 * URL: {NEXT_PUBLIC_APP_URL}/api/webhooks/tiny?token=SEU_TOKEN
 *
 * O processamento de negócio é o mesmo de `/api/tiny/webhook/[secret]`
 * (ver `processTinyWebhookNotification`).
 *
 * Relay opcional: TINY_RELAY_URL — repassa o body bruto após o parse.
 */

import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  parseTinyPayloadFromRequest,
  processTinyWebhookNotification,
  relayWebhook,
} from "@/lib/tiny/process-webhook-notification";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.TINY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Webhook Tiny] TINY_WEBHOOK_SECRET não configurado - fail-closed");
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 503 });
  }

  const urlToken = request.nextUrl.searchParams.get("token") ?? "";
  const bodyToken = request.headers.get("authorization")?.replace("Bearer ", "") ?? "";

  if (!safeCompare(urlToken, webhookSecret) && !safeCompare(bodyToken, webhookSecret)) {
    console.warn("[Webhook Tiny] Token inválido recebido");
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { payload, rawBody, contentType } = await parseTinyPayloadFromRequest(request);
  if (!payload) {
    return NextResponse.json(
      { error: "Payload inválido ou malformado." },
      { status: 400 }
    );
  }

  relayWebhook(rawBody, contentType).catch((err) =>
    console.error("[Webhook Tiny] Erro no relay:", err)
  );

  const supabase = getServiceClient();
  const result = await processTinyWebhookNotification(supabase, payload);

  console.info(`[Webhook Tiny] Resultado:`, result.message);

  return NextResponse.json({
    received: true,
    ok: result.ok,
    message: result.message,
  });
}

/** GET — verificação de health pelo Tiny antes de ativar o webhook */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const hasSecret = !!process.env.TINY_WEBHOOK_SECRET;
  const webhookUrl = hasSecret
    ? `${appUrl}/api/webhooks/tiny?token=***`
    : `${appUrl}/api/webhooks/tiny`;

  return NextResponse.json({
    status: "active",
    message: "ADDS CRM — Webhook Tiny ERP ativo.",
    webhook_url: webhookUrl,
    token_protected: hasSecret,
  });
}
