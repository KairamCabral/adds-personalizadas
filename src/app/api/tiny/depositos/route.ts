import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tinyApiGet, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

export interface TinyDeposito {
  id: number;
  name: string;
  notes: string | null;
  is_active: boolean;
}

interface AttemptLog {
  endpoint: string;
  ok: boolean;
  hint?: string;
}

async function getRequester() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile?.role) return null;
  return { userId: user.id, role: profile.role as string };
}

function asNum(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  return undefined;
}

/**
 * Extrai SÓ a chave literal "depositos" do payload (não recursivo abrangente,
 * para não confundir com `variacoes` que também tem id+nome).
 * Aceita: { depositos }, { data: { depositos } }, { estoque: { depositos } }.
 */
function findDepositosArray(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.depositos)) return obj.depositos;
  if (obj.data && typeof obj.data === "object") {
    const data = obj.data as Record<string, unknown>;
    if (Array.isArray(data.depositos)) return data.depositos;
  }
  if (obj.estoque && typeof obj.estoque === "object") {
    const estoque = obj.estoque as Record<string, unknown>;
    if (Array.isArray(estoque.depositos)) return estoque.depositos;
  }
  return [];
}

function mapDeposito(raw: unknown): TinyDeposito | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id =
    asNum(obj.id) ??
    asNum(obj.idDeposito) ??
    asNum(obj.id_deposito) ??
    asNum((obj.deposito as Record<string, unknown> | undefined)?.id);
  if (!id) return null;
  const nome =
    (typeof obj.nome === "string" && obj.nome) ||
    (typeof obj.descricao === "string" && obj.descricao) ||
    (typeof obj.empresa === "string" && obj.empresa) ||
    `Depósito ${id}`;
  return {
    id,
    name: nome,
    notes: null,
    is_active: true,
  };
}

/**
 * Auto-discover: chama /produtos/{tiny_id de variante}/estoque para os primeiros
 * produtos sincronizados e extrai a lista única de depósitos.
 *
 * Usar tiny_id DE VARIANTE (cor) em vez do produto pai evita pegar `variacoes`
 * por engano. Produto pai retorna variacoes+depositos; variante retorna só depositos.
 */
async function autoDiscoverDepositos(
  attempts: AttemptLog[]
): Promise<TinyDeposito[]> {
  const admin = createAdminClient();
  type ProductLite = {
    id: string;
    name: string;
    tiny_id: number | null;
    tiny_color_map: Record<string, { tiny_id?: number | null }> | null;
  };
  const { data } = await admin
    .from("products")
    .select("id, name, tiny_id, tiny_color_map")
    .not("tiny_id", "is", null)
    .eq("is_active", true)
    .limit(10);
  const products = (data ?? []) as unknown as ProductLite[];

  // Coleta tiny_ids: prioriza variantes (cores)
  type Candidate = { tinyId: number; productName: string; isVariant: boolean };
  const candidates: Candidate[] = [];
  for (const p of products) {
    const colorMap = p.tiny_color_map ?? {};
    let hasVariant = false;
    for (const colorKey of Object.keys(colorMap)) {
      const variantId = colorMap[colorKey]?.tiny_id;
      if (variantId) {
        candidates.push({
          tinyId: variantId,
          productName: `${p.name} (${colorKey})`,
          isVariant: true,
        });
        hasVariant = true;
      }
    }
    // se não tem variante, tenta o produto pai
    if (!hasVariant && p.tiny_id) {
      candidates.push({
        tinyId: p.tiny_id,
        productName: p.name,
        isVariant: false,
      });
    }
  }

  if (candidates.length === 0) {
    attempts.push({
      endpoint: "(auto-discover)",
      ok: false,
      hint: "nenhum produto com tiny_id no CRM",
    });
    return [];
  }

  const seen = new Map<number, TinyDeposito>();

  // Tenta até 3 candidatos diferentes
  for (const c of candidates.slice(0, 3)) {
    for (const path of [`/produtos/${c.tinyId}/estoque`, `/produtos/${c.tinyId}`]) {
      try {
        const raw = await tinyApiGet<unknown>(path);
        const list = findDepositosArray(raw);
        const mapped = list
          .map(mapDeposito)
          .filter((d): d is TinyDeposito => d !== null);

        attempts.push({
          endpoint: `${path} via ${c.productName}`,
          ok: true,
          hint:
            mapped.length > 0
              ? `${mapped.length} depósito(s) encontrado(s)`
              : `array depositos vazio ou inexistente (keys: ${
                  raw && typeof raw === "object"
                    ? Object.keys(raw).slice(0, 8).join(",")
                    : typeof raw
                })`,
        });

        for (const d of mapped) {
          if (!seen.has(d.id)) seen.set(d.id, d);
        }
        if (mapped.length > 0) break; // achou neste endpoint, parte para próximo candidato
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        attempts.push({
          endpoint: `${path} via ${c.productName}`,
          ok: false,
          hint: msg.slice(0, 160),
        });
        if (err instanceof TinyTokenExpiredError) throw err;
      }
    }
    if (seen.size > 0) break;
  }

  return Array.from(seen.values());
}

async function syncDiscoveredIntoCache(
  discovered: TinyDeposito[],
  userId: string
): Promise<void> {
  if (discovered.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  for (const d of discovered) {
    await admin
      .from("tiny_depositos")
      .upsert(
        {
          id: d.id,
          name: d.name,
          notes: null,
          is_active: true,
          created_by: userId,
        },
        { onConflict: "id" }
      );
  }
}

export async function GET(request: NextRequest) {
  const requester = await getRequester();
  if (!requester) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (requester.role !== "MASTER" && requester.role !== "GESTOR") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const cacheRes = await admin
    .from("tiny_depositos")
    .select("id, name, notes, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const cache = (cacheRes.data ?? []) as TinyDeposito[];

  // Se não pediu refresh e já tem cache, retorna direto
  if (!refresh && cache.length > 0) {
    return NextResponse.json({ depositos: cache, source: "cache" });
  }

  // Tenta auto-discover
  const attempts: AttemptLog[] = [];
  let discovered: TinyDeposito[] = [];

  try {
    const connected = await isTinyConnected();
    if (!connected) {
      attempts.push({
        endpoint: "(tiny)",
        ok: false,
        hint: "Tiny ERP não conectado",
      });
    } else {
      discovered = await autoDiscoverDepositos(attempts);
    }
  } catch (err) {
    if (err instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        {
          depositos: cache,
          error: err.message,
          code: "TINY_RECONNECT",
          source: "cache",
        },
        { status: 401 }
      );
    }
    attempts.push({
      endpoint: "(error)",
      ok: false,
      hint: err instanceof Error ? err.message : String(err),
    });
  }

  if (discovered.length > 0 && requester.role === "MASTER") {
    try {
      await syncDiscoveredIntoCache(discovered, requester.userId);
    } catch (err) {
      console.error("[depositos] erro ao salvar cache", err);
    }
  }

  // Merge: discovered + cache (sem duplicar)
  const merged = new Map<number, TinyDeposito>();
  for (const d of cache) merged.set(d.id, d);
  for (const d of discovered) merged.set(d.id, d);
  const final = Array.from(merged.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  );

  return NextResponse.json({
    depositos: final,
    source: discovered.length > 0 ? "auto+cache" : cache.length > 0 ? "cache" : "empty",
    attempts: final.length === 0 ? attempts : undefined,
  });
}

export async function POST(request: NextRequest) {
  const requester = await getRequester();
  if (!requester) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (requester.role !== "MASTER") {
    return NextResponse.json({ error: "Apenas MASTER pode cadastrar." }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: number;
    name?: string;
    notes?: string | null;
  };

  if (!body.id || !Number.isFinite(body.id)) {
    return NextResponse.json(
      { error: "ID numérico do depósito é obrigatório." },
      { status: 400 }
    );
  }
  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Nome do depósito é obrigatório." },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("tiny_depositos")
    .upsert(
      {
        id: body.id,
        name: body.name.trim(),
        notes: body.notes?.trim() || null,
        is_active: true,
        created_by: requester.userId,
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deposito: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const requester = await getRequester();
  if (!requester) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (requester.role !== "MASTER") {
    return NextResponse.json({ error: "Apenas MASTER pode remover." }, { status: 403 });
  }

  const idParam = request.nextUrl.searchParams.get("id");
  const id = idParam ? parseInt(idParam, 10) : null;
  if (!id) {
    return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { error } = await admin
    .from("tiny_depositos")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
