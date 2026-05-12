import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentReferenceMonth } from "@/lib/supplier-inventory/divergence";

type Pool = "PERSONALIZADO" | "MARKETPLACE";
type Status = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

const READ_ROLES = ["MASTER", "GESTOR"] as const;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile?.role || !READ_ROLES.includes(profile.role as (typeof READ_ROLES)[number])) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const month = request.nextUrl.searchParams.get("month") ?? currentReferenceMonth();
  const admin = createAdminClient();

  // 1) Suppliers ativos
  const { data: suppliers, error: supErr } = await admin
    .from("suppliers")
    .select("id, name, is_active")
    .eq("is_active", true);
  if (supErr) return NextResponse.json({ error: supErr.message }, { status: 500 });

  // 2) Inventories do mês para todos os suppliers
  const { data: inventories } = await admin
    .from("supplier_inventories")
    .select("id, supplier_id, status, reference_month, submitted_at, approved_at")
    .eq("reference_month", month);

  const invBySupplier = new Map<
    string,
    { id: string; status: Status; submitted_at: string | null; approved_at: string | null }
  >();
  for (const inv of inventories ?? []) {
    invBySupplier.set(inv.supplier_id as string, {
      id: inv.id as string,
      status: inv.status as Status,
      submitted_at: inv.submitted_at as string | null,
      approved_at: inv.approved_at as string | null,
    });
  }

  const inventoryIds = (inventories ?? []).map((i) => i.id as string);

  // 3) Items dos inventories do mês
  type ItemRow = {
    id: string;
    inventory_id: string;
    product_id: string;
    color_key: string | null;
    pool: Pool;
    quantity_declared: number;
    quantity_committed: number;
    quantity_balance: number;
    tiny_quantity: number | null;
    divergence_status: string | null;
    product: {
      id: string;
      name: string;
      image_url: string | null;
      available_colors: unknown;
      inventory_supplier_id: string | null;
    } | null;
  };

  let items: ItemRow[] = [];
  if (inventoryIds.length > 0) {
    const { data, error: itemsErr } = await admin
      .from("supplier_inventory_items")
      .select(`
        id, inventory_id, product_id, color_key, pool,
        quantity_declared, quantity_committed, quantity_balance,
        tiny_quantity, divergence_status,
        product:products(id, name, image_url, available_colors, inventory_supplier_id)
      `)
      .in("inventory_id", inventoryIds);
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    items = (data ?? []) as ItemRow[];
  }

  // Index items por supplier (via inventory_id → supplier_id)
  const invToSupplier = new Map<string, string>();
  for (const inv of inventories ?? []) {
    invToSupplier.set(inv.id as string, inv.supplier_id as string);
  }

  const itemsBySupplier = new Map<string, ItemRow[]>();
  for (const it of items) {
    const supId = invToSupplier.get(it.inventory_id);
    if (!supId) continue;
    const arr = itemsBySupplier.get(supId) ?? [];
    arr.push(it);
    itemsBySupplier.set(supId, arr);
  }

  // 4) Agregação por fornecedor
  const supplierOverviews = (suppliers ?? []).map((s) => {
    const sItems = itemsBySupplier.get(s.id as string) ?? [];
    const inv = invBySupplier.get(s.id as string);
    const declared = sItems.reduce((a, i) => a + i.quantity_declared, 0);
    const committed = sItems
      .filter((i) => i.pool === "PERSONALIZADO")
      .reduce((a, i) => a + i.quantity_committed, 0);
    const breaks = sItems.filter(
      (i) =>
        i.divergence_status === "BREAK" ||
        i.divergence_status === "COMMITTED_GT_DECLARED"
    ).length;
    const diverges = sItems.filter((i) => i.divergence_status === "DIVERGE").length;
    const matches = sItems.filter((i) => i.divergence_status === "MATCH").length;
    const missing = sItems.filter((i) => i.divergence_status === "MISSING_TINY").length;
    const synced = sItems.filter((i) => i.tiny_quantity != null).length;
    const coverage = sItems.length > 0 ? Math.round((synced / sItems.length) * 100) : 0;

    return {
      id: s.id as string,
      name: s.name as string,
      inventory_id: inv?.id ?? null,
      inventory_status: inv?.status ?? null,
      submitted_at: inv?.submitted_at ?? null,
      approved_at: inv?.approved_at ?? null,
      items_count: sItems.length,
      declared,
      committed,
      balance: declared - committed,
      breaks,
      diverges,
      matches,
      missing,
      coverage_pct: coverage,
    };
  });

  // 5) Totais globais
  const totals = supplierOverviews.reduce(
    (acc, s) => {
      acc.declared += s.declared;
      acc.committed += s.committed;
      acc.balance += s.balance;
      acc.breaks += s.breaks;
      acc.diverges += s.diverges;
      acc.matches += s.matches;
      acc.missing += s.missing;
      acc.items_count += s.items_count;
      return acc;
    },
    {
      declared: 0,
      committed: 0,
      balance: 0,
      breaks: 0,
      diverges: 0,
      matches: 0,
      missing: 0,
      items_count: 0,
    }
  );
  const coverage_pct =
    totals.items_count > 0
      ? Math.round(((totals.items_count - totals.missing) / totals.items_count) * 100)
      : 0;

  // 6) Produtos críticos: BREAK ou saldo<0 ou (declared>0 e balance < 10% de declared)
  type AvailableColor = { key: string; label?: string };
  function parseColors(value: unknown): AvailableColor[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((c): c is Record<string, unknown> => c != null && typeof c === "object")
      .map((c) => ({
        key: String(c.key ?? ""),
        label: typeof c.label === "string" ? c.label : undefined,
      }));
  }
  function colorLabel(item: ItemRow): string | null {
    if (!item.color_key) return null;
    const colors = parseColors(item.product?.available_colors);
    return colors.find((c) => c.key === item.color_key)?.label ?? item.color_key;
  }
  function supplierName(supplierId: string | null): string | null {
    return supplierId
      ? (suppliers ?? []).find((s) => s.id === supplierId)?.name ?? null
      : null;
  }

  const critical = items
    .map((it) => {
      const declared = it.quantity_declared;
      const balance = declared - it.quantity_committed;
      const ratio = declared > 0 ? balance / declared : 1;
      const isBreak =
        it.divergence_status === "BREAK" ||
        it.divergence_status === "COMMITTED_GT_DECLARED";
      const isLow = declared > 0 && ratio < 0.1; // saldo < 10% do declarado
      if (!isBreak && balance >= 0 && !isLow) return null;
      const supplierId =
        invBySupplier.get(
          [...invToSupplier.entries()].find(([invId]) => invId === it.inventory_id)?.[0]!
        )?.id ?? null;
      return {
        item_id: it.id,
        product_id: it.product_id,
        product_name: it.product?.name ?? "Sem nome",
        product_image: it.product?.image_url ?? null,
        color_key: it.color_key,
        color_label: colorLabel(it),
        pool: it.pool,
        declared,
        committed: it.quantity_committed,
        balance,
        divergence_status: it.divergence_status,
        supplier_id: invToSupplier.get(it.inventory_id) ?? null,
        supplier_name: supplierName(invToSupplier.get(it.inventory_id) ?? null),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.balance - b.balance) // mais negativos primeiro
    .slice(0, 10);

  // 7) Produtos não configurados (inventory_pools vazio OU inventory_supplier_id null)
  const { count: unconfiguredCount } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .or("inventory_supplier_id.is.null,inventory_pools.eq.{}");

  const { data: unconfiguredSamples } = await admin
    .from("products")
    .select("id, name, image_url")
    .eq("is_active", true)
    .or("inventory_supplier_id.is.null,inventory_pools.eq.{}")
    .limit(5);

  // 8) Inventários pendentes (DRAFT/SUBMITTED) em qualquer mês — atenção operacional
  const { data: pendingInventories } = await admin
    .from("supplier_inventories")
    .select("id, supplier_id, reference_month, status")
    .in("status", ["DRAFT", "SUBMITTED"])
    .order("reference_month", { ascending: false })
    .limit(10);
  const pending = (pendingInventories ?? []).map((p) => ({
    id: p.id as string,
    supplier_id: p.supplier_id as string,
    supplier_name: supplierName(p.supplier_id as string),
    reference_month: p.reference_month as string,
    status: p.status as Status,
  }));

  return NextResponse.json({
    reference_month: month,
    totals: { ...totals, coverage_pct },
    suppliers: supplierOverviews.sort((a, b) => b.balance - a.balance),
    critical_products: critical,
    unconfigured: {
      count: unconfiguredCount ?? 0,
      samples: (unconfiguredSamples ?? []).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        image_url: p.image_url as string | null,
      })),
    },
    pending_inventories: pending,
  });
}
