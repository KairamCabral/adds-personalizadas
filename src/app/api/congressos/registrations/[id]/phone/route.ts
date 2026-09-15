import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@/lib/constants";

/**
 * Corrige o telefone de um pré-cadastro direto no balcão (E5 — retirada de
 * brindes). Gated `congressos.operate` (MASTER/GESTOR/PRESTADOR), mas a
 * escrita usa o service role: pela RLS, PRESTADOR só tem SELECT em
 * `event_registrations`.
 *
 * Efeitos colaterais deliberados:
 *  • invalida o código de confirmação vigente (ele foi para o número errado);
 *  • se o job de sync com o Tiny ainda não rodou, antecipa a próxima tentativa
 *    — o worker relê a registration e leva o número certo;
 *  • se já rodou (DONE), devolve `tinyAlreadySynced` para a UI avisar: o
 *    worker CRIA ou ENCONTRA o contato no Tiny, nunca ATUALIZA um existente
 *    (ver src/lib/tiny/contacts.ts), então o número antigo continua lá.
 *
 * Não toca em `clients` — tabela compartilhada com o adds-rep-app.
 */

const bodySchema = z.object({
  phone: z
    .string()
    .trim()
    .refine((v) => {
      const d = v.replace(/\D/g, "");
      return d.length === 10 || d.length === 11;
    }, "Telefone deve ter DDD + 8 ou 9 dígitos."),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Telefone inválido." },
        { status: 400 }
      );
    }

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
    if (!hasPermission(role, "congressos.operate")) {
      return NextResponse.json(
        { error: "Sem permissão para corrigir o telefone." },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const phone = parsed.data.phone;

    const { data: updated, error: updateErr } = await admin
      .from("event_registrations")
      .update({ phone })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (updateErr) throw updateErr;
    if (!updated) {
      return NextResponse.json(
        { error: "Pré-cadastro não encontrado." },
        { status: 404 }
      );
    }

    // O código vigente foi enviado para o número antigo — invalida.
    await admin
      .from("event_gift_redemptions")
      .update({
        confirm_code: null,
        confirm_code_sent_at: null,
        confirm_code_phone: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .eq("registration_id", id);

    const { data: job } = await admin
      .from("tiny_contact_sync_jobs")
      .select("id, status")
      .eq("registration_id", id)
      .maybeSingle();

    let tinyAlreadySynced = false;
    if (job) {
      if (job.status === "PENDING" || job.status === "FAILED") {
        await admin
          .from("tiny_contact_sync_jobs")
          .update({ next_attempt_at: new Date().toISOString() })
          .eq("id", job.id);
      } else if (job.status === "DONE") {
        tinyAlreadySynced = true;
      }
    }

    return NextResponse.json({ success: true, phone, tinyAlreadySynced });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error("[congressos/registrations/phone]", e.message);
    return NextResponse.json(
      { error: "Erro ao salvar o telefone." },
      { status: 500 }
    );
  }
}
