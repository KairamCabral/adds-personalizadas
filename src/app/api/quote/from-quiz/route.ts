// src/app/api/quote/from-quiz/route.ts
//
// Recebe o WhatsApp que o dentista informou no quiz (protocolo.addsbrasil.com.br)
// e cria um orçamento PENDENTE para o time trabalhar.
//
// Por que isso existe: até agora, quem clicava no botão do quiz e não mandava
// mensagem sumia sem deixar rastro — era a maior perda do funil. Com o número
// gravado aqui, alguém consegue retomar o contato depois.
//
// Este endpoint NÃO fala com a Meta. O quiz já dispara o `Lead` na CAPI no
// mesmo instante, com o telefone e o fbc do clique no anúncio.

import { NextRequest, NextResponse } from "next/server";

import { safeCompare } from "@/lib/crypto-utils";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

type PublicQuoteInsert = Database["public"]["Tables"]["public_quotes"]["Insert"];

export const dynamic = "force-dynamic";

/** Formata para exibição na lista de orçamentos: `(48) 99999-8888`. */
function formatBrPhone(digits: string): string {
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return digits;
}

export async function POST(request: NextRequest) {
  const secret = process.env.QUIZ_LEAD_SECRET;
  if (!secret) {
    console.error("[quote/from-quiz] QUIZ_LEAD_SECRET não configurado - fail-closed");
    return NextResponse.json({ error: "não configurado" }, { status: 503 });
  }

  if (!safeCompare(request.headers.get("x-quiz-secret") ?? "", secret)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  // Teto de segurança mesmo com o segredo válido: se o quiz entrar em laço ou
  // o segredo vazar, isso limita o estrago em vez de encher a base de leads.
  const { success } = rateLimit(`quote-from-quiz`, { windowMs: 60_000, max: 60 });
  if (!success) return rateLimitResponse();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const digits = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  if (digits.length < 12 || digits.length > 13) {
    // Esperado: 55 + DDD + número (12 ou 13 dígitos). O quiz já normaliza.
    return NextResponse.json({ error: "telefone inválido" }, { status: 400 });
  }

  const leadRef = typeof body.lead_ref === "string" ? body.lead_ref : null;
  const source = typeof body.source === "string" ? body.source : "quiz";

  const supabase = createAdminClient();

  // Só temos o telefone, e `client_name` é o que a lista de orçamentos exibe.
  // Usar o número formatado deixa cada linha identificável e clicável pelo
  // time — um rótulo fixo faria todos os leads do quiz virarem a mesma linha.
  const payload: PublicQuoteInsert = {
    client_name: formatBrPhone(digits),
    client_whatsapp: digits,
    client_phone: digits,
    items: [],
    status: "PENDENTE",
    internal_notes: leadRef
      ? `Lead do quiz. Ref ${leadRef} — aparece na mensagem do WhatsApp.`
      : "Lead do quiz.",
    utm_source: "quiz",
    utm_medium: "whatsapp",
    utm_campaign: source,
    // ⚠️ Marcado como enviado DE PROPÓSITO. O cron meta-capi-dispatch manda um
    // `Lead` para todo orçamento pendente, mas o quiz já disparou o dele pela
    // CAPI com event_id próprio. Sem isso a mesma pessoa contaria duas vezes.
    meta_capi_sent_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("public_quotes")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[quote/from-quiz] erro ao inserir", error);
    return NextResponse.json({ error: "erro ao salvar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, quote_id: data.id });
}
