import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tinyApiGet, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

export interface TinyDeposito {
  id: number;
  name: string;
  notes: string | null;
  is_active: boolean;
  empresa?: string | null;
  desconsiderar?: boolean;
}

interface AttemptLog {
  source: string;
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

/**
 * Auto-discover: chama /estoque/{tiny_id_de_qualquer_variante} e extrai a
 * lista de depósitos do array `depositos[]` retornado pelo Tiny v3.
 * Esse é o caminho confiável — basta UM produto sincronizado para descobrir
 * TODOS os depósitos da conta.
 */
async function autoDiscoverDepositos(
  attempts: AttemptLog[]
): Promise<TinyDeposito[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

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
  const products = (data ?? []) as ProductLite[];

  // Coleta tiny_ids de variantes (priorizado) e produtos pai
  const candidates: Array<{ tinyId: number; label: string }> = [];
  for (const p of products) {
    const colorMap = p.tiny_color_map ?? {};
    for (const [colorKey, m] of Object.entries(colorMap)) {
      if (m?.tiny_id) {
        candidates.push({
          tinyId: m.tiny_id,
          label: `${p.name} (${colorKey})`,
        });
      }
    }
    if (Object.keys(colorMap).length === 0 && p.tiny_id) {
      candidates.push({ tinyId: p.tiny_id, label: p.name });
    }
  }

  if (candidates.length === 0) {
    attempts.push({
      source: "auto-discover",
      ok: false,
      hint: "nenhum produto com tiny_id no CRM",
    });
    return [];
  }

  const seen = new Map<number, TinyDeposito>();

  // Tenta até 3 candidatos diferentes
  for (const c of candidates.slice(0, 3)) {
    try {
      const raw = await tinyApiGet<{
        depositos?: Array<{
          id?: number;
          nome?: string;
          desconsiderar?: boolean;
          empresa?: string;
        }>;
        data?: {
          depositos?: Array<{
            id?: number;
            nome?: string;
            desconsiderar?: boolean;
            empresa?: string;
          }>;
        };
      }>(`/estoque/${c.tinyId}`);
      const root = raw?.data ?? raw;
      const list = root.depositos ?? [];

      for (const d of list) {
        if (!d?.id || !d.nome) continue;
        if (seen.has(d.id)) continue;
        seen.set(d.id, {
          id: d.id,
          name: d.nome,
          notes: null,
          is_active: true,
          empresa: d.empresa ?? null,
          desconsiderar: d.desconsiderar === true,
        });
      }
      attempts.push({
        source: `/estoque/${c.tinyId} via ${c.label}`,
        ok: true,
        hint: `${list.length} depósito(s)`,
      });
      if (seen.size > 0) break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attempts.push({
        source: `/estoque/${c.tinyId} via ${c.label}`,
        ok: false,
        hint: msg.slice(0, 120),
      });
      if (err instanceof TinyTokenExpiredError) throw err;
    }
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

  if (!refresh && cache.length > 0) {
    return NextResponse.json({ depositos: cache, source: "cache" });
  }

  const attempts: AttemptLog[] = [];
  let discovered: TinyDeposito[] = [];

  try {
    const connected = await isTinyConnected();
    if (!connected) {
      attempts.push({ source: "(tiny)", ok: false, hint: "Tiny ERP não conectado" });
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
      source: "(error)",
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
