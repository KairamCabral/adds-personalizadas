import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Busca cliente por CPF/CNPJ (documento normalizado).
 * Usa regexp_replace para comparar ignorando formatação.
 */
export async function GET(request: NextRequest) {
  const document = request.nextUrl.searchParams.get("document")?.trim();
  if (!document) {
    return NextResponse.json({ client: null });
  }

  const digits = document.replace(/\D/g, "");
  if (digits.length < 11) {
    return NextResponse.json({ client: null });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.rpc("find_client_by_document", {
    doc_digits: digits,
  });

  if (error) {
    console.error("[find-by-document] RPC error:", error);
    return NextResponse.json({ client: null });
  }

  return NextResponse.json({ client: data?.[0] ?? null });
}
