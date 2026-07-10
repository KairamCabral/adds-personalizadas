import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import { requeueSyncJob } from "@/services/congressos-sync.service";
import { TinyTokenExpiredError } from "@/lib/tiny-api";
import type { UserRole } from "@/lib/constants";

export const maxDuration = 60;

/**
 * Reprocessa um job de sync MORTO/FALHO (E7 / Story 7.1). Gated MASTER/GESTOR
 * (`congressos.manage`). Reseta para PENDING e tenta na hora via admin client.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
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

    const role = (profile?.role ?? "PRESTADOR") as UserRole;
    if (!hasPermission(role, "congressos.manage")) {
      return NextResponse.json(
        { error: "Sem permissão para reprocessar a fila." },
        { status: 403 }
      );
    }

    const result = await requeueSyncJob(id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { success: false, error: err.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    const e = err instanceof Error ? err : new Error(String(err));
    console.error("[congressos/sync-jobs/requeue]", e.message);
    return NextResponse.json(
      { success: false, error: "Erro ao reprocessar o job." },
      { status: 500 }
    );
  }
}
