import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { Database } from "@/types/database.types";

type PublicQuoteInsert = Database["public"]["Tables"]["public_quotes"]["Insert"];

interface CreatePublicQuoteBody {
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  client_whatsapp?: string | null;
  client_document?: string | null;
  client_city?: string | null;
  client_state?: string | null;
  client_zip_code?: string | null;
  client_street?: string | null;
  client_number?: string | null;
  client_complement?: string | null;
  client_neighborhood?: string | null;
  client_social_media?: string | null;
  client_logo_url?: string | null;
  is_existing_client?: boolean;
  existing_client_id?: string | null;
  items: unknown;
  personalization?: unknown;
  estimated_value?: number | null;
}

/**
 * Recebe os dados do formulário público de orçamento e insere em public_quotes
 * usando o service role, evitando 401 por RLS/anon no cliente.
 */
export async function POST(request: NextRequest) {
  // ═══ RATE LIMIT ═══
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const { success } = rateLimit(`quote:${ip}`, { windowMs: 300000, max: 10 }); // 10 req / 5 min
  if (!success) return rateLimitResponse();

  try {
    const data = (await request.json()) as CreatePublicQuoteBody;

    if (!data?.client_name || typeof data.client_name !== "string") {
      return NextResponse.json(
        { error: "Dados inválidos: client_name obrigatório" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const payload: PublicQuoteInsert = {
      client_name: data.client_name,
      client_email: data.client_email ?? null,
      client_phone: data.client_phone ?? null,
      client_whatsapp: data.client_whatsapp ?? null,
      client_document: data.client_document ?? null,
      client_city: data.client_city ?? null,
      client_state: data.client_state ?? null,
      client_zip_code: data.client_zip_code ?? null,
      client_street: data.client_street ?? null,
      client_number: data.client_number ?? null,
      client_complement: data.client_complement ?? null,
      client_neighborhood: data.client_neighborhood ?? null,
      client_social_media: data.client_social_media ?? null,
      client_logo_url: data.client_logo_url ?? null,
      is_existing_client: data.is_existing_client ?? false,
      existing_client_id: data.existing_client_id ?? null,
      items: data.items as PublicQuoteInsert["items"],
      personalization: (data.personalization ?? null) as PublicQuoteInsert["personalization"],
      estimated_value: data.estimated_value ?? null,
      status: "PENDENTE",
    };

    const { data: quote, error } = await supabase
      .from("public_quotes")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("[quote/submit] Insert error:", error);
      return NextResponse.json(
        { error: error.message || "Erro ao salvar orçamento" },
        { status: 500 }
      );
    }

    return NextResponse.json({ quote });
  } catch (err) {
    console.error("[quote/submit] Error:", err);
    return NextResponse.json(
      { error: "Erro interno ao processar orçamento" },
      { status: 500 }
    );
  }
}
