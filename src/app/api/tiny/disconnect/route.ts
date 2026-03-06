import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export async function POST() {
  // ═══ AUTH CHECK ═══
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase
      .from("app_settings")
      .delete()
      .eq("key", "tiny_oauth_tokens");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Tiny disconnect error:", err);
    return NextResponse.json(
      { success: false, error: "Erro ao desconectar o Tiny ERP." },
      { status: 500 }
    );
  }
}
