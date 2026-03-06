import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { Resend } from "resend";
import { z } from "zod";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

const emailSchema = z.object({
  to: z.string().email("Email inválido"),
  subject: z.string().min(1, "Assunto obrigatório").max(200, "Assunto muito longo"),
  html: z.string().max(50000, "Conteúdo muito longo"),
});

/** Remove scripts e handlers on* do HTML para evitar XSS */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
}

export async function POST(request: NextRequest) {
  // ═══ RATE LIMIT ═══
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const { success } = rateLimit(`email:${ip}`, { windowMs: 60000, max: 5 });
  if (!success) return rateLimitResponse();

  // ═══ AUTH CHECK ═══
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = emailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const sanitizedHtml = sanitizeHtml(parsed.data.html);

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Serviço de e-mail não configurado (RESEND_API_KEY)" },
        { status: 503 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [parsed.data.to],
      subject: parsed.data.subject,
      html: sanitizedHtml,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json(
      { error: "Erro interno ao enviar e-mail" },
      { status: 500 }
    );
  }
}
