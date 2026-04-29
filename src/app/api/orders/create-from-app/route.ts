import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  tinyApiPost,
  isTinyConnected,
  TinyTokenExpiredError,
} from "@/lib/tiny-api";
import { formatProductWithColor } from "@/lib/products/format";
import type { Database } from "@/types/database.types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Valida o Bearer token JWT do Supabase enviado pelo app mobile.
 * Retorna o user_id se válido, ou null caso contrário.
 */
async function validateBearerToken(
  authHeader: string | null
): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const supabase = getServiceClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user.id;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const corsHeaders = CORS_HEADERS;

  try {
    // Validar Bearer token
    const authHeader = request.headers.get("authorization");
    const userId = await validateBearerToken(authHeader);

    if (!userId) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { orderId } = body as { orderId?: string };

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId é obrigatório" },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = getServiceClient();

    // Buscar pedido com dados do cliente
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, clients(*)")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Pedido não encontrado" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Verificar se o pedido já foi sincronizado
    if ((order as any).tiny_order_id) {
      return NextResponse.json(
        {
          success: true,
          orderId,
          tinyOrderId: (order as any).tiny_order_id,
          message: "Pedido já sincronizado com o Tiny",
        },
        { headers: corsHeaders }
      );
    }

    // Buscar itens do pedido
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    // Buscar tiny_seller_id do representante
    let tinySellerIdFromRep: string | null = null;
    if ((order as any).rep_id) {
      const { data: repProfile } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", (order as any).rep_id)
        .single();

      if (repProfile?.notification_preferences) {
        const extras = repProfile.notification_preferences as Record<string, unknown>;
        tinySellerIdFromRep = (extras.tiny_seller_id as string | null) ?? null;
      }
    }

    // Tentar criar no Tiny ERP
    const connected = await isTinyConnected();

    if (!connected) {
      // Tiny não conectado — marcar synced_at mesmo assim para não bloquear o app
      await supabase
        .from("orders")
        .update({ synced_at: new Date().toISOString() } as any)
        .eq("id", orderId);

      return NextResponse.json(
        {
          success: true,
          orderId,
          message: "Pedido salvo no CRM (Tiny não conectado)",
        },
        { headers: corsHeaders }
      );
    }

    try {
      const client = (order as any).clients;

      // Formatar itens para o Tiny — descrição combina product_name + color_name
      // dinamicamente via helper (banco mantém os campos separados).
      const tinyItems = (orderItems ?? []).map((item: any) => ({
        produto: {
          id: item.tiny_product_id ?? undefined,
          codigo: item.product_code ?? item.sku ?? undefined,
          descricao: item.product_name
            ? formatProductWithColor({
                product_name: item.product_name,
                color_name: item.color_name,
              })
            : item.description ?? "Produto",
        },
        quantidade: item.quantity ?? 1,
        valorUnitario: item.unit_price ?? item.price ?? 0,
        desconto: item.discount_percentage ?? (order as any).discount_percentage ?? 0,
      }));

      // Payload para criar pedido no Tiny
      const tinyPayload: Record<string, unknown> = {
        situacao: "aberto",
        dataPedido: new Date().toISOString().split("T")[0],
        observacoes: `Pedido criado pelo app representantes. ID: ${orderId}`,
        contato: client
          ? {
              nome: client.name ?? client.nome ?? "Cliente",
              cpfCnpj:
                (client.document ?? client.cpf_cnpj ?? "").replace(/\D/g, "") ||
                undefined,
              fone:
                (client.phone ?? client.fone ?? "").replace(/\D/g, "") ||
                undefined,
              email: client.email ?? undefined,
            }
          : undefined,
        itens: tinyItems,
      };

      if ((order as any).discount_percentage) {
        tinyPayload.desconto = (order as any).discount_percentage;
      }

      if (tinySellerIdFromRep) {
        tinyPayload.vendedor = { id: Number(tinySellerIdFromRep) };
        console.log(`[create-from-app] Incluindo vendedor Tiny ID: ${tinySellerIdFromRep}`);
      }

      const tinyResult = await tinyApiPost<Record<string, unknown>>(
        "/pedidos",
        tinyPayload
      );

      const tinyOrderId =
        (tinyResult as any)?.id ??
        (tinyResult as any)?.data?.id ??
        (tinyResult as any)?.retorno?.registros?.[0]?.registro?.id;

      // Atualizar pedido com ID do Tiny
      await supabase
        .from("orders")
        .update({
          ...(tinyOrderId ? { tiny_order_id: tinyOrderId } : {}),
          synced_at: new Date().toISOString(),
        } as any)
        .eq("id", orderId);

      console.log(
        `[create-from-app] Pedido ${orderId} sincronizado com Tiny. tinyOrderId=${tinyOrderId ?? "N/A"} vendedor=${tinySellerIdFromRep ?? "N/A"}`
      );

      return NextResponse.json(
        {
          success: true,
          orderId,
          tinyOrderId: tinyOrderId ?? null,
          message: "Pedido sincronizado com sucesso",
        },
        { headers: corsHeaders }
      );
    } catch (tinyError: any) {
      const isTinyExpired = tinyError instanceof TinyTokenExpiredError;
      console.error("[create-from-app] Erro ao criar pedido no Tiny:", tinyError);

      // Marcar synced_at mesmo com falha para não bloquear o app
      await supabase
        .from("orders")
        .update({ synced_at: new Date().toISOString() } as any)
        .eq("id", orderId);

      return NextResponse.json(
        {
          success: false,
          orderId,
          error: isTinyExpired
            ? "Tiny ERP não conectado. Configure em Integrações."
            : "Pedido salvo no CRM mas falha ao sincronizar com Tiny",
          tinyError: tinyError.message,
        },
        { status: 207, headers: corsHeaders }
      );
    }
  } catch (error: any) {
    console.error("[create-from-app] Erro interno:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500, headers: corsHeaders }
    );
  }
}
