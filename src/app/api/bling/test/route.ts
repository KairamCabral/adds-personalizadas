import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const { apiToken, baseUrl } = body;

    if (!apiToken || typeof apiToken !== "string") {
      return NextResponse.json(
        { success: false, message: "Token é obrigatório." },
        { status: 400 }
      );
    }

    const url = baseUrl ?? process.env.BLING_API_URL ?? "https://api.bling.com.br/Api/v3";
    const finalUrl = url.replace(/\/$/, "");

    const res = await fetch(`${finalUrl}/contatos?limite=1`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({
        success: false,
        message: `Erro ${res.status}: ${text.slice(0, 200)}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : "Erro de conexão",
    });
  }
}
