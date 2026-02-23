import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MIGRATIONS = [
  "ALTER TABLE products ADD COLUMN IF NOT EXISTS print_area_image_url TEXT;",
  "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bling_client_id TEXT;",
  "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bling_client_secret TEXT;",
  "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bling_access_token TEXT;",
  "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bling_refresh_token TEXT;",
  "ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bling_token_expires_at TIMESTAMPTZ;",
];

/**
 * POST /api/admin/run-migration
 * Aplica todas as migrations pendentes.
 * Só pode ser chamado por usuários autenticados com papel MASTER.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "MASTER") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const admin = createAdminClient();
    const fullSql = MIGRATIONS.join("\n");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).rpc("exec_sql", { sql: fullSql });

    if (error) {
      return NextResponse.json(
        {
          error: "Não foi possível aplicar as migrations automaticamente.",
          instructions:
            "Execute o SQL abaixo no Supabase → SQL Editor:",
          sql: fullSql,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "Migrations aplicadas com sucesso!" });
  } catch (err) {
    const fullSql = MIGRATIONS.join("\n");
    return NextResponse.json(
      {
        error: "Erro interno",
        instructions: "Execute o SQL abaixo no Supabase → SQL Editor:",
        sql: fullSql,
      },
      { status: 500 }
    );
  }
}
