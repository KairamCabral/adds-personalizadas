import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tinyApiGet, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

type Pool = "PERSONALIZADO" | "MARKETPLACE";

interface TinyProductDetail {
  id?: number;
  nome?: string;
  descricao?: string;
  codigo?: string;
  preco?: number | string;
  precoCusto?: number | string;
  preco_custo?: number | string;
  estoque?: number | string;
  saldo?: number | string;
  data?: TinyProductDetail;
}

interface ImportBody {
  tiny_ids: number[];
  pools: Pool[];
  tiny_deposito_personalizado_id?: number | null;
  tiny_deposito_marketplace_id?: number | null;
}

function parseNum(value: number | string | undefined | null): number | null {
  if (value == null) return null;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

function unwrap<T extends TinyProductDetail>(raw: T): T {
  return (raw?.data ?? raw) as T;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: supplierId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "MASTER") {
    return NextResponse.json({ error: "Apenas MASTER pode importar produtos." }, { status: 403 });
  }

  const body = (await request.json()) as ImportBody;
  if (!Array.isArray(body.tiny_ids) || body.tiny_ids.length === 0) {
    return NextResponse.json({ error: "Lista de tiny_ids vazia." }, { status: 400 });
  }
  if (!Array.isArray(body.pools) || body.pools.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um pool." }, { status: 400 });
  }

  const connected = await isTinyConnected();
  if (!connected) {
    return NextResponse.json(
      { error: "Tiny ERP não conectado.", code: "TINY_NOT_CONNECTED" },
      { status: 422 }
    );
  }

  const admin = createAdminClient();

  // Confirma supplier
  const { data: supplier } = await admin
    .from("suppliers")
    .select("id")
    .eq("id", supplierId)
    .maybeSingle();
  if (!supplier) {
    return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
  }

  // Já existentes no CRM (por tiny_id)
  type ExistingRow = {
    id: string;
    name: string;
    tiny_id: number | null;
    inventory_supplier_id: string | null;
    inventory_pools: Pool[] | null;
  };
  const { data: existing } = await admin
    .from("products")
    .select("id, name, tiny_id, inventory_supplier_id, inventory_pools")
    .in("tiny_id", body.tiny_ids);

  const existingByTinyId = new Map<number, ExistingRow>();
  for (const p of (existing ?? []) as ExistingRow[]) {
    if (p.tiny_id != null) existingByTinyId.set(p.tiny_id, p);
  }

  const created: Array<{ tinyId: number; name: string; productId: string }> = [];
  const linked: Array<{ tinyId: number; name: string; productId: string }> = [];
  const errors: string[] = [];

  try {
    for (const tinyId of body.tiny_ids) {
      try {
        if (existingByTinyId.has(tinyId)) {
          // Apenas atualiza vínculo + pools (preserva resto)
          const p = existingByTinyId.get(tinyId)!;
          const { error: upErr } = await admin
            .from("products")
            .update({
              inventory_supplier_id: supplierId,
              inventory_pools: body.pools,
              tiny_deposito_personalizado_id: body.tiny_deposito_personalizado_id ?? null,
              tiny_deposito_marketplace_id: body.tiny_deposito_marketplace_id ?? null,
            } as never)
            .eq("id", p.id);
          if (upErr) {
            errors.push(`tiny_id=${tinyId} (já existe '${p.name}'): ${upErr.message}`);
            continue;
          }
          linked.push({ tinyId, name: p.name, productId: p.id });
          continue;
        }

        // Buscar no Tiny e criar
        const raw = await tinyApiGet<TinyProductDetail>(`/produtos/${tinyId}`);
        const data = unwrap(raw);
        const name = data.nome ?? data.descricao ?? `Produto Tiny ${tinyId}`;
        const tinyCode = data.codigo ?? null;
        const cost = parseNum(data.precoCusto ?? data.preco_custo);
        const price = parseNum(data.preco);
        const stock = parseNum(data.estoque ?? data.saldo);

        const { data: inserted, error: insErr } = await admin
          .from("products")
          .insert({
            name,
            tiny_id: tinyId,
            tiny_code: tinyCode,
            cost_price: cost,
            price: price ?? 0,
            tiny_stock: stock ?? 0,
            tiny_synced_at: new Date().toISOString(),
            is_active: true,
            inventory_supplier_id: supplierId,
            inventory_pools: body.pools,
            tiny_deposito_personalizado_id: body.tiny_deposito_personalizado_id ?? null,
            tiny_deposito_marketplace_id: body.tiny_deposito_marketplace_id ?? null,
            available_colors: [],
          } as never)
          .select("id, name")
          .single();
        if (insErr || !inserted) {
          errors.push(`tiny_id=${tinyId}: ${insErr?.message ?? "falha ao inserir"}`);
          continue;
        }
        created.push({ tinyId, name: inserted.name, productId: inserted.id });
      } catch (err) {
        if (err instanceof TinyTokenExpiredError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`tiny_id=${tinyId}: ${msg}`);
      }
    }
  } catch (err) {
    if (err instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { error: err.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    throw err;
  }

  return NextResponse.json({
    success: true,
    created: created.length,
    linked: linked.length,
    errors: errors.length > 0 ? errors : undefined,
    details: { created, linked },
  });
}
