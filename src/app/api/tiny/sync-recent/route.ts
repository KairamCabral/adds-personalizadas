import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import { TinyTokenExpiredError } from "@/lib/tiny-api";
import { runIncrementalClientsSync } from "@/lib/tiny-sync-incremental";
import type { UserRole } from "@/lib/constants";

export const maxDuration = 60;

/**
 * Sincroniza apenas os contatos mais recentes do Tiny (incremental).
 * Leve: processa até 5 páginas (500 contatos) com early exit quando possível.
 */
export async function POST() {
  try {
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
    if (!hasPermission(role, "clients.sync_tiny")) {
      return NextResponse.json(
        { error: "Sem permissão para sincronizar contatos." },
        { status: 403 }
      );
    }

    const result = await runIncrementalClientsSync();

    return NextResponse.json({
      success: result.success,
      synced: result.synced,
      pagesProcessed: result.pagesProcessed,
      earlyExit: result.earlyExit,
      message: result.message,
    });
  } catch (err) {
    if (err instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { success: false, error: err.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    const e = err instanceof Error ? err : new Error(String(err));
    console.error("[Tiny Sync Recent] Erro:", e.message);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
