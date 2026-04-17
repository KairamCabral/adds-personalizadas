import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tinyApiGet, TinyTokenExpiredError } from "@/lib/tiny-api";

export async function POST(
  request: NextRequest,
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
        { error: "Apenas MASTER ou GESTOR podem vincular pedidos ao Tiny." },
        { status: 403 }
      );
    }

    const { id: orderId } = await context.params;
    const body = await request.json();
    const numeroPedido = body.numeroPedido;

    if (!numeroPedido) {
      return NextResponse.json(
        { error: "Número do pedido Tiny é obrigatório." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, tiny_order_id, title")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Pedido não encontrado no CRM." },
        { status: 404 }
      );
    }

    if (order.tiny_order_id) {
      return NextResponse.json(
        { error: `Pedido já vinculado ao Tiny (ID: ${order.tiny_order_id}).` },
        { status: 409 }
      );
    }

    let tinyResponse: unknown;
    try {
      tinyResponse = await tinyApiGet(
        `/pedidos?numeroPedido=${encodeURIComponent(String(numeroPedido))}&limit=5`
      );
    } catch (err) {
      if (err instanceof TinyTokenExpiredError) {
        return NextResponse.json(
          { error: err.message, code: "TINY_RECONNECT" },
          { status: 401 }
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Erro ao buscar no Tiny: ${msg}` },
        { status: 502 }
      );
    }

    const itens =
      (tinyResponse as { itens?: unknown })?.itens ??
      (tinyResponse as { data?: { itens?: unknown } })?.data?.itens ??
      (tinyResponse as { data?: unknown[] })?.data ??
      [];

    const results = Array.isArray(itens) ? itens : [];

    let tinyOrderId: number | null = null;
    let tinyOrderInfo: {
      numeroPedido: number;
      cliente?: string | null;
      data?: string | null;
    } | null = null;

    for (const item of results) {
      const raw =
        item && typeof item === "object" && "pedido" in item
          ? (item as { pedido: Record<string, unknown> }).pedido
          : (item as Record<string, unknown>);
      const num = raw.numeroPedido ?? raw.numero ?? raw.numero_pedido;
      if (String(num) === String(numeroPedido)) {
        const idVal = raw.id;
        tinyOrderId =
          typeof idVal === "number"
            ? idVal
            : typeof idVal === "string"
              ? Number(idVal)
              : NaN;
        if (!Number.isFinite(tinyOrderId)) {
          tinyOrderId = null;
          continue;
        }
        const clienteRaw = raw.cliente;
        const nomeCliente =
          clienteRaw &&
          typeof clienteRaw === "object" &&
          "nome" in (clienteRaw as object)
            ? String((clienteRaw as { nome?: string }).nome ?? "")
            : typeof raw.nomeCliente === "string"
              ? raw.nomeCliente
              : null;
        tinyOrderInfo = {
          numeroPedido: Number(num),
          cliente: nomeCliente,
          data: typeof raw.data === "string" ? raw.data : null,
        };
        break;
      }
    }

    if (!tinyOrderId) {
      return NextResponse.json(
        {
          error: `Pedido #${numeroPedido} não encontrado no Tiny.`,
          hint: "Verifique o número do pedido e tente novamente.",
        },
        { status: 404 }
      );
    }

    const { data: existing } = await supabase
      .from("orders")
      .select("id, title")
      .eq("tiny_order_id", tinyOrderId)
      .neq("id", orderId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: `Pedido Tiny #${numeroPedido} já vinculado ao pedido CRM "${existing.title}".`,
          conflictOrderId: existing.id,
        },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        tiny_order_id: tinyOrderId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tinyOrderId,
      tinyOrderInfo,
      message: `Pedido vinculado ao Tiny #${numeroPedido} com sucesso.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    console.error("[link-tiny]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
