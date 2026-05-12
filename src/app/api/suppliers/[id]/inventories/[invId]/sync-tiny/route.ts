import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";
import {
  fetchTinyStockForProduct,
  type ProductColorMap,
} from "@/lib/tiny/supplier-stock-sync";

type Pool = "PERSONALIZADO" | "MARKETPLACE";

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

  if (profile?.role !== "MASTER" && profile?.role !== "GESTOR") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const connected = await isTinyConnected();
  if (!connected) {
    return NextResponse.json(
      { error: "Tiny ERP não conectado. Configure em Configurações > Integrações.", code: "TINY_NOT_CONNECTED" },
      { status: 422 }
    );
  }

  const admin = createAdminClient();

  // Confirma vínculo + carrega items + produtos
  const { data: items, error: itemsErr } = await admin
    .from("supplier_inventory_items")
    .select(`
      id, product_id, color_key, pool, tiny_quantity,
      product:products(
        id, tiny_id, tiny_color_map,
        tiny_deposito_personalizado_id, tiny_deposito_marketplace_id,
        inventory_supplier_id
      ),
      inventory:supplier_inventories!inner(id, supplier_id)
    `)
    .eq("inventory_id", invId);

  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  // Filtra apenas items do supplier correto (proteção extra)
  const ownItems = (items ?? []).filter(
    (it) => {
      const inv = it.inventory as { supplier_id?: string } | null;
      return inv?.supplier_id === supplierId;
    }
  );

  if (ownItems.length === 0) {
    return NextResponse.json({ error: "Inventário sem itens ou não pertence ao fornecedor." }, { status: 404 });
  }

  try {
    // Agrupa por (product_id, pool) para minimizar chamadas Tiny
    const groups = new Map<string, typeof ownItems>();
    for (const it of ownItems) {
      const key = `${it.product_id}|${it.pool}`;
      const arr = groups.get(key) ?? [];
      arr.push(it);
      groups.set(key, arr);
    }

    const errors: string[] = [];
    const now = new Date().toISOString();
    const CONCURRENCY = 5;

    // Processa N grupos em paralelo, mantendo controle de concorrência simples
    const groupEntries = Array.from(groups.entries());
    let cursor = 0;

    const processNext = async (): Promise<number> => {
      let localSynced = 0;
      while (cursor < groupEntries.length) {
        const idx = cursor++;
        const [groupKey, groupItems] = groupEntries[idx];
        const head = groupItems[0];
        const product = head.product as {
          id: string;
          tiny_id: number | null;
          tiny_color_map: ProductColorMap | null;
          tiny_deposito_personalizado_id: number | null;
          tiny_deposito_marketplace_id: number | null;
        } | null;
        if (!product) continue;

        const pool = head.pool as Pool;
        const depositoId =
          pool === "PERSONALIZADO"
            ? product.tiny_deposito_personalizado_id
            : product.tiny_deposito_marketplace_id;

        if (!product.tiny_id && !product.tiny_color_map) {
          errors.push(`${groupKey}: produto sem tiny_id nem cores mapeadas`);
          continue;
        }

        const { results, errors: fetchErrors } = await fetchTinyStockForProduct({
          tinyId: product.tiny_id,
          tinyColorMap: product.tiny_color_map,
          depositoId,
        });
        if (fetchErrors.length > 0) errors.push(...fetchErrors.map((e) => `${groupKey}: ${e}`));

        const stockByColor = new Map<string, number>();
        for (const r of results) {
          stockByColor.set(r.colorKey ?? "", r.stock);
        }

        for (const it of groupItems) {
          const stock = stockByColor.get(it.color_key ?? "");
          if (stock == null) continue;
          const { error: updErr } = await admin
            .from("supplier_inventory_items")
            .update({ tiny_quantity: stock, tiny_synced_at: now })
            .eq("id", it.id);
          if (updErr) {
            errors.push(`item ${it.id}: ${updErr.message}`);
          } else {
            localSynced += 1;
          }
        }
      }
      return localSynced;
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, groupEntries.length) }, () =>
      processNext()
    );
    const syncedCounts = await Promise.all(workers);
    const synced = syncedCounts.reduce((a, b) => a + b, 0);

    // Recompute classifica divergências baseado no novo tiny_quantity
    await admin.rpc("recompute_supplier_inventory", { p_inventory_id: invId });

    return NextResponse.json({
      success: true,
      synced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { error: error.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[inventories/sync-tiny]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
