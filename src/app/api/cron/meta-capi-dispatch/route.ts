import { NextRequest, NextResponse } from "next/server";

import { safeCompare } from "@/lib/crypto-utils";
import {
  buildLeadEvent,
  buildPurchaseEvent,
  hasMatchKey,
  sendEventToMeta,
} from "@/lib/meta-capi";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 50;

/**
 * Envia à Meta Conversions API os dois eventos de fundo de funil, ambos
 * idempotentes por `meta_capi_sent_at IS NULL`:
 *
 * - **Purchase** (valor real) para cada pedido FATURADO — NF emitida no Tiny,
 *   i.e. `tiny_invoice_id` preenchido.
 * - **Lead** para cada orçamento do formulário público ainda não enviado.
 *
 * Por que o Lead sai daqui e não do clique no WhatsApp: o orçamento traz nome,
 * e-mail e telefone reais, então a correspondência no Meta é alta. O clique no
 * botão do quiz não carrega dado nenhum do usuário e infla volume sem qualidade.
 *
 * Segurança: por padrão roda em DRY-RUN (não envia nada ao Meta). Só envia de
 * verdade com `META_CAPI_ENABLED=true`. Use `META_TEST_EVENT_CODE` para validar
 * no "Testar eventos" do Meta sem afetar dados de produção.
 *
 * Autenticação: Bearer CRON_SECRET (igual aos demais crons).
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/meta-capi-dispatch] CRON_SECRET não configurado - fail-closed");
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    return NextResponse.json(
      { error: "META_PIXEL_ID / META_CONVERSIONS_API_ACCESS_TOKEN ausentes" },
      { status: 503 },
    );
  }
  const enabled = process.env.META_CAPI_ENABLED === "true";
  const testEventCode = process.env.META_TEST_EVENT_CODE || undefined;

  const supabase = createAdminClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, contact_phone, contact_name, client_id")
    .not("tiny_invoice_id", "is", null)
    .is("meta_capi_sent_at", null)
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[cron/meta-capi-dispatch] erro ao buscar pedidos", error);
    return NextResponse.json({ error: "Erro ao buscar pedidos" }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const order of orders ?? []) {
    const { data: items } = await supabase
      .from("order_items")
      .select("total_price, unit_price, quantity")
      .eq("order_id", order.id);

    let client = null;
    if (order.client_id) {
      const { data } = await supabase
        .from("clients")
        .select("email, phone, name")
        .eq("id", order.client_id)
        .maybeSingle();
      client = data ?? null;
    }

    const event = buildPurchaseEvent({ order, client, items: items ?? [] });

    if (!hasMatchKey(event)) {
      skipped++;
      details.push({ order: order.order_number, skipped: "sem telefone/e-mail para match" });
      continue;
    }

    const result = await sendEventToMeta(event, {
      pixelId,
      accessToken,
      enabled,
      testEventCode,
    });

    if (result.ok && result.mode === "live") {
      await supabase
        .from("orders")
        .update({ meta_capi_sent_at: new Date().toISOString() })
        .eq("id", order.id);
      sent++;
      details.push({ order: order.order_number, value: event.custom_data.value, ok: true });
    } else if (result.ok && result.mode === "dry-run") {
      // DRY-RUN: não marca como enviado, para que o envio real aconteça quando ativarmos.
      skipped++;
      details.push({ order: order.order_number, value: event.custom_data.value, dryRun: true });
    } else {
      failed++;
      console.error(
        "[cron/meta-capi-dispatch] falha no envio",
        order.order_number,
        result.status,
        result.body,
      );
      details.push({ order: order.order_number, ok: false, status: result.status });
    }
  }

  // ═══ Lead: orçamentos do formulário público ═══
  // A janela de 7 dias é dupla proteção. (1) A Meta recusa `event_time` mais
  // antigo que 7 dias, então mandar histórico só geraria erro. (2) Impede que
  // uma linha antiga com `meta_capi_sent_at` nulo — restore de backup, import,
  // migration reaplicada — vire um Lead falsamente recente na otimização.
  const leadCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: quotes, error: quotesError } = await supabase
    .from("public_quotes")
    .select(
      "id, created_at, client_name, client_email, client_phone, client_whatsapp, estimated_value, utm_source, utm_medium, utm_campaign",
    )
    .is("meta_capi_sent_at", null)
    .gte("created_at", leadCutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  let leadsSent = 0;
  let leadsSkipped = 0;
  let leadsFailed = 0;

  if (quotesError) {
    // Não aborta: o Purchase acima já pode ter sido enviado, e devolver 500
    // aqui faria a Vercel reexecutar o cron e reprocessar tudo à toa.
    console.error("[cron/meta-capi-dispatch] erro ao buscar orçamentos", quotesError);
  }

  for (const quote of quotes ?? []) {
    const event = buildLeadEvent({ quote });

    if (!hasMatchKey(event)) {
      leadsSkipped++;
      details.push({ quote: quote.id, skipped: "sem telefone/e-mail para match" });
      continue;
    }

    const result = await sendEventToMeta(event, {
      pixelId,
      accessToken,
      enabled,
      testEventCode,
      // Hora REAL do orçamento, não a do cron. O cron roda uma vez por dia, e
      // carimbar tudo com "agora" faria a Meta atribuir o lead ao dia errado.
      eventTimeUnix: Math.floor(new Date(quote.created_at).getTime() / 1000),
    });

    if (result.ok && result.mode === "live") {
      await supabase
        .from("public_quotes")
        .update({ meta_capi_sent_at: new Date().toISOString() })
        .eq("id", quote.id);
      leadsSent++;
      details.push({ quote: quote.id, value: event.custom_data.value, ok: true });
    } else if (result.ok && result.mode === "dry-run") {
      // DRY-RUN não marca como enviado, para o envio real acontecer ao ativar.
      leadsSkipped++;
      details.push({ quote: quote.id, value: event.custom_data.value, dryRun: true });
    } else {
      leadsFailed++;
      console.error(
        "[cron/meta-capi-dispatch] falha no envio do Lead",
        quote.id,
        result.status,
        result.body,
      );
      details.push({ quote: quote.id, ok: false, status: result.status });
    }
  }

  return NextResponse.json({
    success: true,
    mode: enabled ? "live" : "dry-run",
    purchase: {
      candidates: orders?.length ?? 0,
      sent,
      skipped,
      failed,
    },
    lead: {
      candidates: quotes?.length ?? 0,
      sent: leadsSent,
      skipped: leadsSkipped,
      failed: leadsFailed,
    },
    ...(enabled
      ? {}
      : { note: "DRY-RUN: nada enviado ao Meta. Defina META_CAPI_ENABLED=true para ativar." }),
    details,
  });
}
