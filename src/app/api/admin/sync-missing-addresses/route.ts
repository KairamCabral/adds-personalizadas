import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { syncClientsFromTinyBatch } from "@/services/clients-tiny-sync";
import { createClient as createServerClient } from "@/lib/supabase/server";

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { data: profile } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "MASTER") {
      return NextResponse.json(
        { error: "Apenas MASTER pode rodar sync em batch." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 50, 200);
    const onlyWithDocument = body.onlyWithDocument !== false;

    const db = getServiceClient();

    let query = db
      .from("clients")
      .select("id, name, tiny_id, document")
      .not("tiny_id", "is", null)
      .is("street", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (onlyWithDocument) {
      query = query.not("document", "is", null);
    }

    const { data: candidates, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhum cliente para sincronizar",
        total: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    const ids = candidates.map((c) => c.id);
    const result = await syncClientsFromTinyBatch(ids);

    return NextResponse.json({
      success: true,
      ...result,
      candidates_processed: candidates.map((c) => ({
        id: c.id,
        name: c.name,
        tiny_id: c.tiny_id,
      })),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao rodar batch sync.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
