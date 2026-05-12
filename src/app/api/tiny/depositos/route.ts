import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TinyDeposito {
  id: number;
  name: string;
  notes: string | null;
  is_active: boolean;
}

async function getRequester() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile?.role) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(_request: NextRequest) {
  const requester = await getRequester();
  if (!requester) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (requester.role !== "MASTER" && requester.role !== "GESTOR") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("tiny_depositos")
    .select("id, name, notes, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ depositos: data ?? [] });
}

export async function POST(request: NextRequest) {
  const requester = await getRequester();
  if (!requester) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (requester.role !== "MASTER") {
    return NextResponse.json({ error: "Apenas MASTER pode cadastrar." }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: number;
    name?: string;
    notes?: string | null;
  };

  if (!body.id || !Number.isFinite(body.id)) {
    return NextResponse.json(
      { error: "ID numérico do depósito é obrigatório." },
      { status: 400 }
    );
  }
  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Nome do depósito é obrigatório." },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("tiny_depositos")
    .upsert(
      {
        id: body.id,
        name: body.name.trim(),
        notes: body.notes?.trim() || null,
        is_active: true,
        created_by: requester.userId,
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deposito: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const requester = await getRequester();
  if (!requester) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (requester.role !== "MASTER") {
    return NextResponse.json({ error: "Apenas MASTER pode remover." }, { status: 403 });
  }

  const idParam = request.nextUrl.searchParams.get("id");
  const id = idParam ? parseInt(idParam, 10) : null;
  if (!id) {
    return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  // Soft-delete: desativa em vez de remover (preserva referências)
  const { error } = await admin
    .from("tiny_depositos")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
