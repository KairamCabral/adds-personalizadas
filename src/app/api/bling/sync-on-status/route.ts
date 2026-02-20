import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendClientToBling } from "@/services/bling.service";

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

    if (newStatus !== "ARTE_APROVADA") {
      return NextResponse.json({
        success: true,
        message: "Status não é APROVADO, nenhum envio necessário.",
        results: [],
      });
    }

    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("is_active", true);

    if (!suppliers || suppliers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhum fornecedor ativo.",
        results: [],
      });
    }

    const results: Array<{
      supplierId: string;
      supplierName: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const supplier of suppliers) {
      const result = await sendClientToBling(
        supplier.id,
        orderId,
        user.id
      );
      results.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        success: result.success,
        error: result.error,
      });
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao sincronizar com Bling.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
