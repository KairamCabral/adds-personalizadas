import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRecentBlingOrder, sendOrderToBling } from "@/services/bling.service";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const { supplierId, orderId, force = false } = body;

    if (!supplierId || !orderId) {
      return NextResponse.json(
        { error: "supplierId e orderId são obrigatórios." },
        { status: 400 }
      );
    }

    if (!force) {
      const duplicateCheck = await checkRecentBlingOrder(
        supplierId,
        orderId,
        supabase
      );
      if (duplicateCheck.hasDuplicate) {
        return NextResponse.json({
          success: false,
          requiresConfirmation: true,
          recentOrders: duplicateCheck.recentOrders,
          message:
            "Este cliente já tem pedido(s) enviado(s) ao Bling nos últimos 30 dias.",
        });
      }
    }

    const result = await sendOrderToBling(
      supplierId,
      orderId,
      user.id,
      supabase,
      { force }
    );

    if (result.orderSent) {
      return NextResponse.json({
        success: true,
        contactSent: result.contactSent,
        orderSent: result.orderSent,
        blingOrderId: result.blingOrderId,
        blingOrderNumber: result.blingOrderNumber,
        alreadyExisted: result.alreadyExisted,
        message: result.alreadyExisted
          ? `Pedido já estava sincronizado no Bling (nº ${result.blingOrderNumber ?? result.blingOrderId}). Nenhum novo pedido criado.`
          : undefined,
      });
    }

    return NextResponse.json(
      {
        success: false,
        contactSent: result.contactSent,
        orderSent: result.orderSent,
        error: result.error ?? "Erro ao enviar dados.",
      },
      { status: 400 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao sincronizar com Bling.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
