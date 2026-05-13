import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tinyApiGet, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

/**
 * Endpoint de debug — MASTER only.
 *
 * Faz N chamadas à API Tiny v3 com um tiny_id de variante e devolve o JSON
 * cru de cada uma. Usado para descobrir QUAL endpoint dessa conta retorna
 * estoque por depósito (a doc não bate em todas as versões de OAuth).
 *
 * Uso: /api/tiny/debug-product?tiny_id=809742525&sku=ESC-ADDS-IMPLANT-EM-1
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "MASTER") {
    return NextResponse.json({ error: "Apenas MASTER." }, { status: 403 });
  }

  const tinyId = request.nextUrl.searchParams.get("tiny_id");
  const sku = request.nextUrl.searchParams.get("sku");
  const nome = request.nextUrl.searchParams.get("nome") ?? "Implant";

  if (!tinyId) {
    return NextResponse.json({ error: "tiny_id é obrigatório." }, { status: 400 });
  }

  const connected = await isTinyConnected();
  if (!connected) {
    return NextResponse.json(
      { error: "Tiny não conectado." },
      { status: 422 }
    );
  }

  const endpoints = [
    `/produtos/${tinyId}`,
    `/produtos/${tinyId}/estoque`,
    `/produtos/${tinyId}/saldos`,
    sku ? `/produtos?codigo=${encodeURIComponent(sku)}&limit=5` : null,
    `/produtos?nome=${encodeURIComponent(nome)}&limit=5`,
    `/estoque/${tinyId}`,
    `/estoque?idProduto=${tinyId}`,
    `/estoque/produtos?idProduto=${tinyId}`,
    `/lancamentos-estoque?idProduto=${tinyId}&limit=3`,
    `/depositos`,
    `/depositos?limit=20`,
  ].filter(Boolean) as string[];

  const results: Record<string, unknown> = {};

  for (const endpoint of endpoints) {
    try {
      const raw = await tinyApiGet<unknown>(endpoint);
      // truncate stringification para evitar payload gigante
      const json = JSON.stringify(raw);
      results[endpoint] = {
        ok: true,
        keys:
          raw && typeof raw === "object" && !Array.isArray(raw)
            ? Object.keys(raw)
            : Array.isArray(raw)
              ? `Array(${raw.length})`
              : typeof raw,
        sample: json.length > 4000 ? json.slice(0, 4000) + "…(truncated)" : raw,
      };
    } catch (err) {
      if (err instanceof TinyTokenExpiredError) {
        return NextResponse.json(
          { error: err.message, code: "TINY_RECONNECT" },
          { status: 401 }
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      results[endpoint] = {
        ok: false,
        error: msg.slice(0, 400),
      };
    }
  }

  return NextResponse.json({
    tiny_id: tinyId,
    sku,
    nome,
    results,
  });
}
