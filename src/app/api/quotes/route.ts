import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicQuote } from "@/services/quotes.service";

const PAGE_SIZE = 20;
const ALLOWED_ROLES = ["MASTER", "GESTOR"] as const;

export async function GET(request: NextRequest) {
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

    const role = profile?.role as string | undefined;
    if (!role || !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json(
        { error: "Sem permissão para visualizar orçamentos." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") ?? "ALL") as
      | "ALL"
      | "PENDENTE_CONTACTADO"
      | "PENDENTE"
      | "CONTACTADO"
      | "CONCLUIDO"
      | "APROVADO"
      | "REJEITADO";
    const search = searchParams.get("search") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10)));

    const admin = createAdminClient();

    let query = admin
      .from("public_quotes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status && status !== "ALL") {
      if (status === "PENDENTE_CONTACTADO") {
        query = query.in("status", ["PENDENTE", "CONTACTADO"]);
      } else {
        query = query.eq("status", status);
      }
    }

    if (search && search.trim().length >= 2) {
      const sanitized = search.trim().replace(/%/g, "\\%").replace(/_/g, "\\_");
      query = query.or(
        `client_name.ilike.%${sanitized}%,client_email.ilike.%${sanitized}%,client_phone.ilike.%${sanitized}%,client_document.ilike.%${sanitized}%`
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("[api/quotes] Supabase error:", error);
      return NextResponse.json(
        { error: error.message ?? "Erro ao buscar orçamentos" },
        { status: 500 }
      );
    }

    const quotes = (data ?? []) as unknown as PublicQuote[];

    const assignedIds = [...new Set(quotes.map((q) => q.assigned_to).filter(Boolean))] as string[];
    let profilesMap: Record<string, { id: string; full_name: string; avatar_url: string | null }> = {};
    if (assignedIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", assignedIds);
      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
      }
    }

    const quotesWithProfile = quotes.map((q) => ({
      ...q,
      assigned_profile: q.assigned_to && profilesMap[q.assigned_to]
        ? profilesMap[q.assigned_to]
        : null,
    }));

    return NextResponse.json({
      quotes: quotesWithProfile,
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err) {
    console.error("[api/quotes] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}
