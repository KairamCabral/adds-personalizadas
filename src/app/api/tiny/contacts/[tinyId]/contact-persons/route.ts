import { NextRequest, NextResponse } from "next/server";
import { tinyApiGet, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

interface TinyContactDetail {
  pessoasContato?: Array<{
    nome?: string;
    cargo?: string;
    email?: string;
    fone?: string;
    celular?: string;
  }>;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tinyId: string }> }
) {
  const { tinyId } = await params;

  try {
    const connected = await isTinyConnected();
    if (!connected) {
      return NextResponse.json({ pessoas: [] });
    }

    const data = await tinyApiGet<{ data?: TinyContactDetail; contato?: TinyContactDetail }>(
      `/contatos/${tinyId}`
    );

    const contact: TinyContactDetail = data?.data ?? data?.contato ?? {};
    const pessoas = (contact.pessoasContato ?? []).map((p) => ({
      nome: p.nome ?? null,
      cargo: p.cargo ?? null,
      email: p.email ?? null,
      fone: p.fone ?? null,
      celular: p.celular ?? null,
    }));

    return NextResponse.json({ pessoas });
  } catch (err) {
    if (err instanceof TinyTokenExpiredError) {
      return NextResponse.json({ pessoas: [], code: "TINY_RECONNECT" }, { status: 401 });
    }
    console.error("[Tiny contact-persons]", err);
    return NextResponse.json({ pessoas: [] });
  }
}
