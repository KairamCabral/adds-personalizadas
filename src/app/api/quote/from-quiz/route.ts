// src/app/api/quote/from-quiz/route.ts
//
// Recebe o WhatsApp que o dentista informou no quiz (protocolo.addsbrasil.com.br)
// e grava em `leads`.
//
// Por que isso existe: até esta rota, quem clicava no botão do quiz e não
// mandava mensagem sumia sem deixar rastro — a maior perda do funil. Com o
// número gravado, alguém consegue retomar o contato depois.
//
// Antes gravava em `public_quotes`, o que estava errado: orçamento tem produtos
// e valor; lead tem só um telefone. Ver a migration 20260729100000_leads_area.
//
// Este endpoint NÃO fala com a Meta. O quiz já dispara o `Lead` na CAPI no mesmo
// instante, com o telefone e o fbc do clique no anúncio.

import { NextRequest, NextResponse } from "next/server";

import { safeCompare } from "@/lib/crypto-utils";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

  // Mesma pessoa preenchendo de novo NÃO vira linha duplicada — vira sinal.
  // Quem volta é o lead mais quente da lista, e o time precisa ver isso em vez
  // de descobrir três registros iguais espalhados.
  const { data: existente } = await supabase
    .from("leads")
    .select("id, submissions, status")
    .eq("phone", digits)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("leads")
      .update({
        submissions: existente.submissions + 1,
        last_submitted_at: new Date().toISOString(),
        // Voltar a preencher o formulário é intenção nova: se já tinha sido
        // descartado, volta para a fila. Um lead já CONTATADO ou CONVERTIDO
        // mantém o status — quem está cuidando não perde o contexto.
        ...(existente.status === "DESCARTADO" ? { status: "NOVO" as const } : {}),
      })
      .eq("id", existente.id);

    if (error) {
      console.error("[quote/from-quiz] erro ao atualizar lead", error);
      return NextResponse.json({ error: "erro ao salvar" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, lead_id: existente.id, repeat: true });
  }

  // O nome NÃO é gravado aqui. Ele é resolvido na leitura, cruzando o telefone
  // com Contatos — assim, se o contato for cadastrado depois, o nome aparece
  // sozinho, sem job de sincronização e sem risco de dado velho.
  const { data, error } = await supabase
    .from("leads")
    .insert({
      phone: digits,
      source: "quiz",
      lead_ref: leadRef,
      utm_source: "quiz",
      utm_medium: "whatsapp",
      utm_campaign: source,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[quote/from-quiz] erro ao inserir lead", error);
    return NextResponse.json({ error: "erro ao salvar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lead_id: data.id });
}
