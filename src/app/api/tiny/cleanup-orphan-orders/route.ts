import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { tinyApiGet, TinyTokenExpiredError } from "@/lib/tiny-api";
import {
  isPersonalizadasOrder,
  unwrapTinyOrderResponse,
} from "@/lib/tiny/tiny-order-import";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type Decision = "toTrash" | "kept" | "unverified";
type Mode = "reclassify" | "zero-items";

type ResultRow = {
  id: string;
  title: string | null;
  tiny_order_id: number | null;
  num_items: number;
  decision: Decision;
  reason: string;
};

/**
 * Limpeza dos pedidos NÃO-personalizadas que poluíram o pipeline — ex.: os
 * importados pelo bulk sync antigo, que não aplicava o filtro isPersonalizadasOrder.
 *
 * Sempre reversível: manda pra Lixeira (soft-delete `deleted_at`; purga só após
 * 30 dias pelo cron). NUNCA apaga de vez. dryRun=true (padrão) não toca em nada.
 * Apenas MASTER.
 *
 * Modos:
 * - "reclassify" (padrão): re-busca cada pedido no Tiny e re-aplica
 *   isPersonalizadasOrder (mesma regra do webhook). Só vai pra Lixeira o que NÃO
 *   é personalizada. Pedido que não pôde ser re-buscado fica "unverified" e é
 *   preservado. Exige token Tiny válido.
 * - "zero-items": fallback sem Tiny (use se o token estiver quebrado). Pedido
 *   poluído entrou SEM order_items (não casou com nenhum produto personalizado),
 *   então manda pra Lixeira os candidatos com num_items=0. Revise o dry-run antes.
 *
 * Body: { dryRun?: boolean=true, mode?: "reclassify"|"zero-items", sinceHours?: number=72, limit?: number=500 }
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    const { data: profile } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "MASTER") {
      return NextResponse.json(
        { error: "Apenas MASTER pode rodar a limpeza." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // padrão: true (não apaga nada)
    const mode: Mode = body.mode === "zero-items" ? "zero-items" : "reclassify";
    const sinceHours = Math.min(
      Math.max(Number(body.sinceHours) || 72, 1),
      24 * 30
    );
    const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 1000);
    const sinceIso = new Date(Date.now() - sinceHours * 3_600_000).toISOString();

    const db = getServiceClient();

    // Candidatos: pedidos ativos (fora da lixeira/arquivo) com tiny_order_id,
    // criados na janela. Um pedido legítimo (personalizada) é reconhecido e
    // mantido — só os não-personalizada saem.
    const { data: candidates, error } = await db
      .from("orders")
      .select("id, title, tiny_order_id, status, created_at")
      .not("tiny_order_id", "is", null)
      .is("deleted_at", null)
      .is("archived_at", null)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = candidates ?? [];

    // Contagem de itens por pedido (1 query) — sinal usado pelo modo zero-items
    // e exibido no relatório para revisão.
    const itemCount = new Map<string, number>();
    if (list.length > 0) {
      const { data: items } = await db
        .from("order_items")
        .select("order_id")
        .in(
          "order_id",
          list.map((o) => o.id)
        );
      for (const it of items ?? []) {
        const key = (it as { order_id: string }).order_id;
        itemCount.set(key, (itemCount.get(key) ?? 0) + 1);
      }
    }

    const results: ResultRow[] = [];
    let trashed = 0;
    let tokenExpired = false;

    async function trash(id: string): Promise<string | null> {
      const { error: delErr } = await db
        .from("orders")
        .update({
          deleted_at: new Date().toISOString(),
        } as Database["public"]["Tables"]["orders"]["Update"])
        .eq("id", id)
        .is("deleted_at", null);
      return delErr ? delErr.message : null;
    }

    for (const o of list) {
      const tinyId = o.tiny_order_id;
      const num_items = itemCount.get(o.id) ?? 0;
      const base = { id: o.id, title: o.title, tiny_order_id: tinyId, num_items };

      if (mode === "zero-items") {
        if (num_items > 0) {
          results.push({ ...base, decision: "kept", reason: `tem ${num_items} item(ns)` });
          continue;
        }
        // 0 itens → candidato a Lixeira.
        if (!dryRun) {
          const err2 = await trash(o.id);
          if (err2) {
            results.push({ ...base, decision: "unverified", reason: `erro ao mover p/ lixeira: ${err2}` });
            continue;
          }
          trashed++;
        }
        results.push({ ...base, decision: "toTrash", reason: "sem itens personalizados (0)" });
        continue;
      }

      // mode === "reclassify": re-busca no Tiny e re-classifica.
      if (tinyId == null) {
        results.push({ ...base, decision: "unverified", reason: "sem tiny_order_id" });
        continue;
      }

      let raw: Record<string, unknown> | null = null;
      try {
        const resp = await tinyApiGet(`/pedidos/${tinyId}`);
        raw = unwrapTinyOrderResponse(resp);
      } catch (err) {
        if (err instanceof TinyTokenExpiredError) {
          tokenExpired = true;
          results.push({ ...base, decision: "unverified", reason: "token Tiny expirado" });
          break; // sem token não adianta continuar
        }
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ ...base, decision: "unverified", reason: `falha ao buscar no Tiny: ${msg}` });
        continue;
      }

      if (!raw || raw.id == null) {
        results.push({ ...base, decision: "unverified", reason: "resposta Tiny sem pedido" });
        continue;
      }

      const check = isPersonalizadasOrder(raw);
      if (check.isPersonalizadas) {
        results.push({ ...base, decision: "kept", reason: check.reason });
        continue;
      }

      // Não é personalizada → candidato a Lixeira.
      if (!dryRun) {
        const err2 = await trash(o.id);
        if (err2) {
          results.push({ ...base, decision: "unverified", reason: `erro ao mover p/ lixeira: ${err2}` });
          continue;
        }
        trashed++;
      }
      results.push({ ...base, decision: "toTrash", reason: `não-personalizada (${check.reason})` });
    }

    const count = (d: Decision) => results.filter((r) => r.decision === d).length;

    return NextResponse.json({
      success: true,
      dryRun,
      mode,
      sinceHours,
      tokenExpired,
      totals: {
        candidates: list.length,
        toTrash: count("toTrash"),
        kept: count("kept"),
        unverified: count("unverified"),
        trashed, // efetivamente movidos p/ lixeira (0 em dryRun)
      },
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro na limpeza.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
