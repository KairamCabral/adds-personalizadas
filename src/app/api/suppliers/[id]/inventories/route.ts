import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentReferenceMonth } from "@/lib/supplier-inventory/divergence";

const READ_ROLES = ["MASTER", "GESTOR"] as const;
const WRITE_ROLES = ["MASTER"] as const;

type Role = "MASTER" | "GESTOR" | "PRESTADOR" | "REPRESENTANTE";

async function getRequesterRole(request: NextRequest): Promise<{ userId: string; role: Role } | null> {
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

type AvailableColor = { key: string; label?: string };

function parseAvailableColors(value: unknown): AvailableColor[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is Record<string, unknown> => c != null && typeof c === "object")
    .map((c) => ({
      key: String(c.key ?? ""),
      label: typeof c.label === "string" ? c.label : undefined,
    }))
    .filter((c) => c.key.length > 0);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: supplierId } = await context.params;
  const requester = await getRequesterRole(request);
  if (!requester) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!READ_ROLES.includes(requester.role as (typeof READ_ROLES)[number])) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("supplier_inventories")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("reference_month", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ inventories: data ?? [] });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: supplierId } = await context.params;
  const requester = await getRequesterRole(request);
  if (!requester) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!WRITE_ROLES.includes(requester.role as (typeof WRITE_ROLES)[number])) {
    return NextResponse.json({ error: "Apenas MASTER pode criar inventários." }, { status: 403 });
  }

  let body: { reference_month?: string; notes?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    // body opcional
  }

  const referenceMonth = body.reference_month ?? currentReferenceMonth();

  const admin = createAdminClient();

  // Garante fornecedor existe
  const { data: supplier, error: supErr } = await admin
    .from("suppliers")
    .select("id, name")
    .eq("id", supplierId)
    .single();

  if (supErr || !supplier) {
    return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
  }

  // Cria header (idempotente: UNIQUE constraint impede duplicata)
  const { data: existing } = await admin
    .from("supplier_inventories")
    .select("id")
    .eq("supplier_id", supplierId)
    .eq("reference_month", referenceMonth)
    .maybeSingle();

  let inventoryId = existing?.id;

  if (!inventoryId) {
    const { data: inserted, error: insErr } = await admin
      .from("supplier_inventories")
      .insert({
        supplier_id: supplierId,
        reference_month: referenceMonth,
        status: "DRAFT",
        source: "internal",
        created_by: requester.userId,
        notes: body.notes ?? null,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      return NextResponse.json(
        { error: insErr?.message ?? "Erro ao criar inventário." },
        { status: 500 }
      );
    }
    inventoryId = inserted.id;
  }

  // Popula items: 1 linha por (produto × cor × pool) para cada produto vinculado ao supplier
  const { data: products, error: prodErr } = await admin
    .from("products")
    .select("id, inventory_pools, available_colors")
    .eq("inventory_supplier_id", supplierId)
    .eq("is_active", true);

  if (prodErr) {
    return NextResponse.json({ error: prodErr.message }, { status: 500 });
  }

  type ItemSeed = {
    inventory_id: string;
    product_id: string;
    pool: "PERSONALIZADO" | "MARKETPLACE";
    color_key: string | null;
  };
  const seeds: ItemSeed[] = [];
  for (const p of products ?? []) {
    const pools = (p.inventory_pools ?? []) as Array<"PERSONALIZADO" | "MARKETPLACE">;
    if (pools.length === 0) continue;
    const colors = parseAvailableColors(p.available_colors);

    for (const pool of pools) {
      if (colors.length === 0) {
        seeds.push({ inventory_id: inventoryId, product_id: p.id, pool, color_key: null });
      } else {
        for (const c of colors) {
          seeds.push({ inventory_id: inventoryId, product_id: p.id, pool, color_key: c.key });
        }
      }
    }
  }

  if (seeds.length > 0) {
    // Índice único é expression-based (COALESCE(color_key, '')) — onConflict não funciona.
    // Fazemos check manual: lista existentes + insere apenas as novas linhas.
    const { data: existingItems, error: existErr } = await admin
      .from("supplier_inventory_items")
      .select("product_id, color_key, pool")
      .eq("inventory_id", inventoryId);
    if (existErr) {
      return NextResponse.json({ error: existErr.message }, { status: 500 });
    }

    const existingSet = new Set(
      (existingItems ?? []).map(
        (it) => `${it.product_id}|${it.color_key ?? ""}|${it.pool}`
      )
    );
    const toInsert = seeds.filter(
      (s) => !existingSet.has(`${s.product_id}|${s.color_key ?? ""}|${s.pool}`)
    );
    if (toInsert.length > 0) {
      const { error: insItemsErr } = await admin
        .from("supplier_inventory_items")
        .insert(toInsert);
      if (insItemsErr) {
        return NextResponse.json({ error: insItemsErr.message }, { status: 500 });
      }
    }
  }

  // Recompute para popular committed + classificar
  await admin.rpc("recompute_supplier_inventory", { p_inventory_id: inventoryId });

  return NextResponse.json({ inventory_id: inventoryId, reference_month: referenceMonth }, { status: 201 });
}
