import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const READ_ROLES = ["MASTER", "GESTOR"] as const;
const WRITE_ROLES = ["MASTER"] as const;

type Role = "MASTER" | "GESTOR" | "PRESTADOR" | "REPRESENTANTE";

async function getRequesterRole(): Promise<{ userId: string; role: Role } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile?.role) return null;
  return { userId: user.id, role: profile.role as Role };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; invId: string }> }
) {
  const { id: supplierId, invId } = await context.params;
  const requester = await getRequesterRole();
  if (!requester) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!READ_ROLES.includes(requester.role as (typeof READ_ROLES)[number])) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: inventory, error: invErr } = await admin
    .from("supplier_inventories")
    .select("*")
    .eq("id", invId)
    .eq("supplier_id", supplierId)
    .single();

  if (invErr || !inventory) {
    return NextResponse.json({ error: "Inventário não encontrado." }, { status: 404 });
  }

  const { data: items, error: itemsErr } = await admin
    .from("supplier_inventory_items")
    .select(`
      *,
      product:products(id, name, available_colors, image_url, tiny_id,
                       tiny_deposito_personalizado_id, tiny_deposito_marketplace_id)
    `)
    .eq("inventory_id", invId)
    .order("pool", { ascending: true });

  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json({ inventory, items: items ?? [] });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; invId: string }> }
) {
  const { id: supplierId, invId } = await context.params;
  const requester = await getRequesterRole();
  if (!requester) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!WRITE_ROLES.includes(requester.role as (typeof WRITE_ROLES)[number])) {
    return NextResponse.json({ error: "Apenas MASTER pode editar." }, { status: 403 });
  }

  const body = (await request.json()) as {
    status?: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
    notes?: string | null;
    rejected_reason?: string | null;
    items?: Array<{
      id: string;
      quantity_declared?: number;
      tiny_quantity?: number | null;
      notes?: string | null;
    }>;
  };

  const admin = createAdminClient();

  // Atualiza header
  const headerPatch: Record<string, unknown> = {};
  if (body.status !== undefined) {
    headerPatch.status = body.status;
    if (body.status === "SUBMITTED") {
      headerPatch.submitted_at = new Date().toISOString();
      headerPatch.submitted_by = requester.userId;
    }
    if (body.status === "APPROVED") {
      headerPatch.approved_at = new Date().toISOString();
      headerPatch.approved_by = requester.userId;
    }
  }
  if (body.notes !== undefined) headerPatch.notes = body.notes;
  if (body.rejected_reason !== undefined) headerPatch.rejected_reason = body.rejected_reason;

  if (Object.keys(headerPatch).length > 0) {
    const { error: headerErr } = await admin
      .from("supplier_inventories")
      .update(headerPatch)
      .eq("id", invId)
      .eq("supplier_id", supplierId);
    if (headerErr) {
      return NextResponse.json({ error: headerErr.message }, { status: 500 });
    }
  }

  // Atualiza items
  if (body.items && body.items.length > 0) {
    for (const it of body.items) {
      const patch: Record<string, unknown> = {};
      if (typeof it.quantity_declared === "number") patch.quantity_declared = it.quantity_declared;
      if (it.tiny_quantity !== undefined) patch.tiny_quantity = it.tiny_quantity;
      if (it.notes !== undefined) patch.notes = it.notes;

      if (Object.keys(patch).length === 0) continue;

      const { error: itemErr } = await admin
        .from("supplier_inventory_items")
        .update(patch)
        .eq("id", it.id)
        .eq("inventory_id", invId);
      if (itemErr) {
        return NextResponse.json({ error: itemErr.message }, { status: 500 });
      }
    }
    // Recompute para reclassificar divergência após mudança de declarado
    await admin.rpc("recompute_supplier_inventory", { p_inventory_id: invId });
  }

  return NextResponse.json({ success: true });
}
