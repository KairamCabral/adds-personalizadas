import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "@/services/users.service";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@/lib/constants";
import { z } from "zod";

const updateProfileSchema = z.object({
  full_name: z.string().min(1).optional(),
  role: z.enum(["MASTER", "GESTOR", "PRESTADOR"]).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const currentRole = (currentProfile?.role ?? "PRESTADOR") as UserRole;

    if (!hasPermission(currentRole, "settings.users")) {
      return NextResponse.json(
        { error: "Sem permissão para editar usuários." },
        { status: 403 }
      );
    }

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", targetId)
      .single();

    if (!targetProfile) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    const targetRole = targetProfile.role as UserRole;

    if (targetRole === "MASTER" && !hasPermission(currentRole, "settings.manage_master")) {
      return NextResponse.json(
        { error: "Apenas MASTER pode editar usuários com função Master." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar." },
        { status: 400 }
      );
    }

    if (data.role === "MASTER" && !hasPermission(currentRole, "settings.manage_master")) {
      return NextResponse.json(
        { error: "Apenas MASTER pode atribuir função Master." },
        { status: 403 }
      );
    }

    await updateProfile(supabase, targetId, data);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao atualizar usuário.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
