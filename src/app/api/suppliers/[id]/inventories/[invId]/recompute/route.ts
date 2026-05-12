import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; invId: string }> }
) {
  const { id: supplierId, invId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "MASTER") {
    return NextResponse.json({ error: "Apenas MASTER pode forçar recompute." }, { status: 403 });
  }

  const admin = createAdminClient();

  // Confirma que o invento pertence ao supplier
  const { data: inv } = await admin
    .from("supplier_inventories")
    .select("id")
    .eq("id", invId)
    .eq("supplier_id", supplierId)
    .maybeSingle();
  if (!inv) {
    return NextResponse.json({ error: "Inventário não encontrado." }, { status: 404 });
  }

  const { error } = await admin.rpc("recompute_supplier_inventory", { p_inventory_id: invId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
