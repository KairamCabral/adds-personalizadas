import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";
import {
  fetchTinyStockForProduct,
  type ProductColorMap,
} from "@/lib/tiny/supplier-stock-sync";

/**
 * Sincroniza o saldo Tiny de cada produto do inventário.
 *
 * Para cada produto único (não por pool — o estoque Tiny é o total agregado
 * da cor, não por depósito). Aplica o mesmo `tiny_quantity` em TODAS as
 * linhas (produto, cor, pool=*) da mesma variante. A classificação de
 * divergência é depois agregada por (produto, cor) pelo recompute_supplier_inventory.
 */
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
      { error: "Tiny ERP não conectado.", code: "TINY_NOT_CONNECTED" },
      { status: 422 }
    );
  }

  const admin = createAdminClient();

  // Carrega items com produto + valida que pertencem ao supplier
  const { data: items, error: itemsErr } = await admin
    .from("supplier_inventory_items")
    .select(`
      id, product_id, color_key, pool,
      product:products(id, tiny_id, tiny_color_map),
      inventory:supplier_inventories!inner(id, supplier_id)
    `)
    .eq("inventory_id", invId);

  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  const ownItems = (items ?? []).filter((it) => {
    const inv = it.inventory as { supplier_id?: string } | null;
    return inv?.supplier_id === supplierId;
  });

  if (ownItems.length === 0) {
    return NextResponse.json(
      { error: "Inventário sem itens ou não pertence ao fornecedor." },
      { status: 404 }
    );
  }

  try {
    // Agrupa por product_id (todas as cores e pools do mesmo produto na MESMA chamada)
    const byProduct = new Map<string, typeof ownItems>();
    for (const it of ownItems) {
      const arr = byProduct.get(it.product_id) ?? [];
      arr.push(it);
      byProduct.set(it.product_id, arr);
    }

    const now = new Date().toISOString();
    const errors: string[] = [];
    const CONCURRENCY = 5;
    const entries = Array.from(byProduct.entries());
    let cursor = 0;
    let synced = 0;

    const processNext = async (): Promise<number> => {
      let localSynced = 0;
      while (cursor < entries.length) {
        const idx = cursor++;
        const [productId, productItems] = entries[idx];
        const head = productItems[0];
        const product = head.product as {
          id: string;
          tiny_id: number | null;
          tiny_color_map: ProductColorMap | null;
        } | null;
        if (!product) continue;

        if (!product.tiny_id && !product.tiny_color_map) {
          errors.push(`${productId}: produto sem tiny_id nem cores mapeadas`);
          continue;
        }

        const { results, errors: fetchErrors } = await fetchTinyStockForProduct({
          tinyId: product.tiny_id,
          tinyColorMap: product.tiny_color_map,
        });
        if (fetchErrors.length > 0)
          errors.push(...fetchErrors.map((e) => `${productId}: ${e}`));

        // Indexa stock por color_key — o mesmo valor vale para todos os pools
        const stockByColor = new Map<string, number>();
        for (const r of results) {
          stockByColor.set(r.colorKey ?? "", r.stock);
        }

        for (const it of productItems) {
          const stock = stockByColor.get(it.color_key ?? "");
          if (stock == null) continue;
          const { error: updErr } = await admin
            .from("supplier_inventory_items")
            .update({ tiny_quantity: stock, tiny_synced_at: now })
            .eq("id", it.id);
          if (updErr) {
            errors.push(`item ${it.id}: ${updErr.message}`);
          } else {
            localSynced++;
          }
        }
      }
      return localSynced;
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, entries.length) },
      () => processNext()
    );
    const counts = await Promise.all(workers);
    synced = counts.reduce((a, b) => a + b, 0);

    // Recompute classifica divergência agregada por (produto, cor)
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
