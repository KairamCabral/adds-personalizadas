import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Exclusão de orçamento público — apenas MASTER.
 * Usa service role porque a tabela public_quotes não tinha policy RLS para DELETE.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "MASTER") {
      return NextResponse.json(
        { error: "Apenas administradores podem excluir orçamentos." },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin.from("public_quotes").delete().eq("id", id);

    if (error) {
      console.error("[api/quotes/[id] DELETE]", error);
      return NextResponse.json(
        { error: error.message ?? "Erro ao excluir orçamento" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/quotes/[id] DELETE]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
