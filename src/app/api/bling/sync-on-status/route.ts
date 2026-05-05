import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOrderToAllActiveSuppliers } from "@/services/bling.service";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, newStatus } = body;

    if (!orderId || !newStatus) {
      return NextResponse.json(
        { error: "orderId e newStatus são obrigatórios." },
        { status: 400 }
      );
    }

    if (newStatus !== "APROVADO") {
      return NextResponse.json({
        success: true,
        message: "Status não dispara envio ao fornecedor.",
        results: [],
      });
    }

    // Mesmo helper usado pelo trigger automático do webhook Tiny — garante
    // idempotência (skip se `bling_order_id` já está setado) e comportamento
    // unificado entre UI e servidor.
    const outcome = await sendOrderToAllActiveSuppliers(
      orderId,
      user.id,
      supabase
    );

    if (outcome.skipped) {
      const messageMap: Record<typeof outcome.reason, string> = {
        already_sent: "Pedido já enviado ao Bling anteriormente.",
        no_active_suppliers: "Nenhum fornecedor ativo.",
        order_not_found: "Pedido não encontrado.",
      };
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: outcome.reason,
        message: messageMap[outcome.reason],
        results: [],
        ...(outcome.reason === "already_sent" && outcome.blingOrderId
          ? { blingOrderId: outcome.blingOrderId }
          : {}),
      });
    }

    return NextResponse.json({
      success: true,
      results: outcome.results,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao sincronizar com Bling.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
