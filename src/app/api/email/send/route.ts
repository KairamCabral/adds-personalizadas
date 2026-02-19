import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, html } = body;

    if (!to || typeof to !== "string") {
      return NextResponse.json(
        { error: "Campo 'to' (destinatário) é obrigatório" },
        { status: 400 }
      );
    }
    if (!subject || typeof subject !== "string") {
      return NextResponse.json(
        { error: "Campo 'subject' (assunto) é obrigatório" },
        { status: 400 }
      );
    }
    if (!html || typeof html !== "string") {
      return NextResponse.json(
        { error: "Campo 'html' (conteúdo) é obrigatório" },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Serviço de e-mail não configurado (RESEND_API_KEY)" },
        { status: 503 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
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
