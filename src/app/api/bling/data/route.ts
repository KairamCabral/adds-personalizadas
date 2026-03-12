import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchBlingData } from "@/services/bling.service";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplier_id");

    if (!supplierId) {
      return NextResponse.json(
        { error: "supplier_id é obrigatório." },
        { status: 400 }
      );
    }

    const result = await fetchBlingData(supplierId, supabase);

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao buscar dados do Bling.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
