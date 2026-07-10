import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import { resendDispatch } from "@/services/congressos-dispatch.service";
import type { UserRole } from "@/lib/constants";

export const maxDuration = 60;

/**
 * Reenvia um e-mail de confirmação FALHO (E7 / Story 7.1). Gated MASTER/GESTOR
 * (`congressos.manage`). Reseta o dispatch para PENDENTE e tenta na hora.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const role = (profile?.role ?? "PRESTADOR") as UserRole;
    if (!hasPermission(role, "congressos.manage")) {
      return NextResponse.json(
        { error: "Sem permissão para reenviar a confirmação." },
        { status: 403 }
      );
    }

    const result = await resendDispatch(id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error("[congressos/dispatches/resend]", e.message);
    return NextResponse.json(
      { success: false, error: "Erro ao reenviar a confirmação." },
      { status: 500 }
    );
  }
}
