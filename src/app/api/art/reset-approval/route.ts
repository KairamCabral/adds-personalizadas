import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@/lib/constants";
import type { OrderStatus } from "@/lib/constants";

const BLOCKED: OrderStatus[] = [
  "PRODUCAO",
  "EXPEDICAO",
  "FINALIZADO",
  "ENTREGUE",
  "FATURADO",
  "ARQUIVADO",
];

/**
 * Reverte aprovação pública; pedido vai para a coluna **AJUSTE** no fim da fila.
 * Acesso: MASTER, GESTOR.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: profile } = await auth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = (profile?.role ?? "PRESTADOR") as UserRole;
    if (!hasPermission(role, "artworks.reset_approval")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await request.json();
    const orderId = body?.orderId as string | undefined;
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "orderId é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, archived_at")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }
    if (order.archived_at) {
      return NextResponse.json(
        { error: "Pedido arquivado; não é possível resetar." },
        { status: 400 }
      );
    }
    if (BLOCKED.includes(order.status as OrderStatus)) {
      return NextResponse.json(
        { error: "Não é possível resetar aprovação nesta etapa do pedido." },
        { status: 400 }
      );
    }

    const { data: artworks, error: artError } = await supabase
      .from("artworks")
      .select("id, version, status")
      .eq("order_id", orderId);

    if (artError) throw artError;
    if (!artworks?.length) {
      return NextResponse.json(
        { error: "Nenhuma arte neste pedido" },
        { status: 400 }
      );
    }

    const maxVersion = Math.max(...artworks.map((a) => a.version), 0);
    const inVersion = artworks.filter((a) => a.version === maxVersion);
    const hasApproved = inVersion.some((a) => a.status === "APROVADA");
    if (!hasApproved) {
      return NextResponse.json(
        { error: "Não há aprovação de cliente na versão atual para resetar." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    for (const a of inVersion) {
      if (a.status === "APROVADA") {
        const { error: u } = await supabase
          .from("artworks")
          .update({
            status: "PENDENTE",
            approved_by: null,
            approved_at: null,
            adjustment_notes: null,
            updated_at: now,
          })
          .eq("id", a.id);
        if (u) throw u;
      } else if (a.status === "DESCARTADA") {
        const { error: u } = await supabase
          .from("artworks")
          .update({
            status: "PENDENTE",
            updated_at: now,
          })
          .eq("id", a.id);
        if (u) throw u;
      }
    }

    const { error: tokenErr } = await supabase
      .from("approval_tokens")
      .update({ expires_at: now })
      .eq("order_id", orderId)
      .is("used_at", null);
    if (tokenErr) throw tokenErr;

    const { count: ajusteCount, error: countError } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "AJUSTE")
      .is("archived_at", null);

    if (countError) throw countError;
    const n = ajusteCount ?? 0;
    // Entrando noutra coluna: fim = índice n; já em AJUSTE: fim = último índice n-1
    const targetPosition =
      order.status === "AJUSTE" ? Math.max(0, n - 1) : n;

    const { error: rpcError } = await (supabase.rpc as any)("move_order_atomic", {
      p_order_id: orderId,
      p_new_status: "AJUSTE",
      p_new_position: targetPosition,
    });
    if (rpcError) throw rpcError;

    await supabase
      .from("order_labels")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .delete()
      .eq("order_id", orderId)
      .eq("label", "LINK_ENVIADO" as any);

    const { error: histError } = await supabase.from("order_history").insert({
      order_id: orderId,
      user_id: user.id,
      action: "artwork_approval_reset",
      new_value: `Aprovação de arte (v${maxVersion}) revertida; pedido movido para Ajuste (fim da fila)`,
    });
    if (histError) throw histError;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("reset-approval", err);
    return NextResponse.json(
      { error: "Erro ao resetar aprovação" },
      { status: 500 }
    );
  }
}
