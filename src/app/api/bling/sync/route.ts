import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendClientToBling } from "@/services/bling.service";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const { supplierId, orderId } = body;

    if (!supplierId || !orderId) {
      return NextResponse.json(
        { error: "supplierId e orderId são obrigatórios." },
        { status: 400 }
      );
    }

    const result = await sendClientToBling(
      supplierId,
      orderId,
      user.id,
      supabase
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Erro ao enviar dados." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      blingContactId: result.blingContactId,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao sincronizar com Bling.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
