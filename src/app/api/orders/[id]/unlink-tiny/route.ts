import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    if (!profile || !["MASTER", "GESTOR"].includes(profile.role as string)) {
      return NextResponse.json(
        { error: "Apenas MASTER ou GESTOR podem desvincular pedidos do Tiny." },
        { status: 403 }
      );
    }

    const { id: orderId } = await context.params;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, tiny_order_id, tiny_invoice_id, title")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Pedido não encontrado no CRM." },
        { status: 404 }
      );
    }

    if (!order.tiny_order_id) {
      return NextResponse.json(
        { error: "Este pedido não está vinculado a nenhum pedido do Tiny." },
        { status: 400 }
      );
    }

    const previousTinyOrderId = order.tiny_order_id;
    const previousTinyInvoiceId = order.tiny_invoice_id;

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        tiny_order_id: null,
        tiny_invoice_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Auditoria — não bloqueia resposta se falhar
    try {
      await supabase.from("order_history").insert({
        order_id: orderId,
        user_id: user.id,
        action: "tiny_unlinked",
        new_value: `tiny_order_id=${previousTinyOrderId}${
          previousTinyInvoiceId ? `, tiny_invoice_id=${previousTinyInvoiceId}` : ""
        }`,
      });
    } catch (auditErr) {
      console.warn("[unlink-tiny] Falha ao registrar auditoria:", auditErr);
    }

    return NextResponse.json({
      success: true,
      previousTinyOrderId,
      previousTinyInvoiceId,
      message: `Pedido desvinculado do Tiny #${previousTinyOrderId} com sucesso.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    console.error("[unlink-tiny]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
