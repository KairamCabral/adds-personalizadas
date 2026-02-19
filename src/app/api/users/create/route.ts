import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@/lib/constants";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  full_name: z.string().min(1, "Nome é obrigatório"),
  role: z.enum(["MASTER", "GESTOR", "PRESTADOR"]),
});

export async function POST(request: NextRequest) {
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

    const currentRole = (profile?.role ?? "PRESTADOR") as UserRole;

    if (!hasPermission(currentRole, "settings.users")) {
      return NextResponse.json(
        { error: "Sem permissão para criar usuários." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Dados inválidos.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { email, password, full_name, role } = parsed.data;

    if (role === "MASTER" && !hasPermission(currentRole, "settings.manage_master")) {
      return NextResponse.json(
        { error: "Apenas MASTER pode criar usuários com função Master." },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const { data: newUser, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
      },
    });

    if (error) {
      if (error.message.includes("already been registered")) {
        return NextResponse.json(
          { error: "Este e-mail já está cadastrado." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message ?? "Erro ao criar usuário." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      id: newUser.user.id,
      email: newUser.user.email,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao criar usuário.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
