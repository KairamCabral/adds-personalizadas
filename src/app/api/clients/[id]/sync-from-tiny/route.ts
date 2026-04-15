import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncClientFromTiny } from "@/services/clients-tiny-sync";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "ID do cliente é obrigatório." },
        { status: 400 }
      );
    }

    const result = await syncClientFromTiny(id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      client: result.client,
      fieldsUpdated: result.fieldsUpdated,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao sincronizar com Tiny.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
