import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { forwardToNI } from "@/lib/tiny/webhook-forwarder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function extractOrderFields(payload: unknown): {
  tinyOrderId: number | null;
  eventType: string | null;
} {
  const top = payload as Record<string, unknown>;
  const dados =
    top?.dados &&
    typeof top.dados === "object" &&
    top.dados !== null &&
    !Array.isArray(top.dados)
      ? (top.dados as Record<string, unknown>)
      : top;

  const tinyOrderId =
    (dados?.idPedido as number | string | undefined) ??
    (dados?.id_pedido as number | string | undefined) ??
    (dados?.pedido as { id?: number } | undefined)?.id ??
    (dados?.id as number | string | undefined) ??
    null;

  const eventType =
    (top?.tipo as string | undefined) ??
    (top?.evento as string | undefined) ??
    (top?.tipoNotificacao as string | undefined) ??
    (dados?.tipo as string | undefined) ??
    null;

  return {
    tinyOrderId: tinyOrderId != null ? Number(tinyOrderId) : null,
    eventType,
  };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ secret: string }> }
) {
  const { secret } = await context.params;
  const expected = process.env.TINY_WEBHOOK_SECRET?.trim();

  if (!expected) {
    console.error("[tiny-webhook] TINY_WEBHOOK_SECRET não configurado");
    return new Response("misconfigured", { status: 503 });
  }

  if (secret !== expected) {
    return new Response("forbidden", { status: 403 });
  }

  try {
    const rawBody = await req.text();

    let payload: Json;
    try {
      payload = rawBody ? (JSON.parse(rawBody) as Json) : {};
    } catch {
      const params = new URLSearchParams(rawBody);
      const obj: Record<string, unknown> = Object.fromEntries(params.entries());
      if (typeof obj.dados === "string") {
        try {
          obj.dados = JSON.parse(obj.dados) as unknown;
        } catch {
          /* mantém string */
        }
      }
      payload = obj as Json;
    }

    const headers = Object.fromEntries(req.headers.entries());
    const sourceIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const { tinyOrderId, eventType } = extractOrderFields(payload);

    const supabaseAdmin = getServiceClient();

    const { data: eventRecord, error } = await supabaseAdmin
      .from("tiny_webhook_events")
      .insert({
        source_ip: sourceIp,
        headers: headers as Json,
        payload,
        event_type: eventType,
        tiny_order_id: tinyOrderId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[tiny-webhook] insert failed:", error);
    }

    if (eventRecord?.id) {
      forwardToNI({
        rawBody,
        originalHeaders: headers,
      })
        .then(async (result) => {
          const { error: updErr } = await supabaseAdmin
            .from("tiny_webhook_events")
            .update({
              forwarded_to_ni_at: new Date().toISOString(),
              forwarded_status: result.status,
              forwarded_http_code: result.http_code,
              forwarded_error: result.error,
            })
            .eq("id", eventRecord.id);
          if (updErr) {
            console.error("[tiny-webhook-forward] update failed:", updErr);
          }
        })
        .catch((err: unknown) => {
          console.error("[tiny-webhook-forward] unexpected error:", err);
        });
    }

    return new Response("ok", { status: 200 });
  } catch (err: unknown) {
    console.error("[tiny-webhook] error:", err);
    return new Response("received", { status: 200 });
  }
}
