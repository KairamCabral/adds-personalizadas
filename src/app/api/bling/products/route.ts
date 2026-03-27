import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type BlingProductResult = {
  id: number;
  sku: string | null;
  name: string;
};

async function getValidBlingToken(
  supplierId: string,
  supplier: {
    bling_api_token?: string | null;
    bling_access_token?: string | null;
    bling_refresh_token?: string | null;
    bling_client_id?: string | null;
    bling_client_secret?: string | null;
    bling_token_expires_at?: string | null;
  },
  db: ReturnType<typeof createClient> extends Promise<infer T> ? T : never
): Promise<string | null> {
  const expiresAt = supplier.bling_token_expires_at
    ? new Date(supplier.bling_token_expires_at).getTime()
    : 0;
  const now = Date.now();
  const bufferMs = 60_000;

  if (supplier.bling_access_token && expiresAt > now + bufferMs) {
    return supplier.bling_access_token;
  }

  if (
    supplier.bling_refresh_token &&
    supplier.bling_client_id &&
    supplier.bling_client_secret
  ) {
    const basicAuth = Buffer.from(
      `${supplier.bling_client_id}:${supplier.bling_client_secret}`
    ).toString("base64");

    try {
      const res = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: supplier.bling_refresh_token,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newExpiresAt = new Date(
          Date.now() + (data.expires_in ?? 21600) * 1000
        ).toISOString();

        await db
          .from("suppliers")
          .update({
            bling_access_token: data.access_token,
            bling_refresh_token: data.refresh_token ?? supplier.bling_refresh_token,
            bling_token_expires_at: newExpiresAt,
          })
          .eq("id", supplierId);

        return data.access_token;
      }
    } catch {
      // fall through to legacy token
    }
  }

  const legacy = (supplier.bling_api_token ?? "").trim();
  return legacy || null;
}

/**
 * GET /api/bling/products?supplier_id=X&q=termo
 *
 * Busca produtos no Bling pelo nome/SKU. Retorna até 30 resultados incluindo variações.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get("supplier_id");
    const q = (searchParams.get("q") ?? "").trim();

    if (!supplierId) {
      return NextResponse.json(
        { error: "supplier_id é obrigatório." },
        { status: 400 }
      );
    }

    const { data: supplier } = await supabase
      .from("suppliers")
      .select(
        "bling_api_token, bling_access_token, bling_refresh_token, bling_client_id, bling_client_secret, bling_token_expires_at, bling_base_url"
      )
      .eq("id", supplierId)
      .single();

    if (!supplier) {
      return NextResponse.json(
        { error: "Fornecedor não encontrado." },
        { status: 404 }
      );
    }

    const token = await getValidBlingToken(supplierId, supplier, supabase);
    if (!token) {
      return NextResponse.json(
        { error: "Bling não configurado neste fornecedor. Conecte em Configurações → Fornecedores." },
        { status: 422 }
      );
    }

    const baseUrl =
      (supplier.bling_base_url as string | null) ??
      process.env.BLING_API_URL ??
      "https://api.bling.com.br/Api/v3";

    const headers = { Authorization: `Bearer ${token}` };

    // Bling v3 para produtos: "pesquisa=" é ignorado pela API (retorna todos sem filtrar).
    // Apenas "codigo=" (busca exata por SKU) funciona como filtro.
    // Quando há query → tenta codigo= (busca exata). Sem query → lista com paginação.
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    let url: string;
    if (q.length >= 1) {
      url = `${baseUrl}/produtos?codigo=${encodeURIComponent(q)}&criterio=5&limite=50`;
    } else {
      url = `${baseUrl}/produtos?criterio=5&limite=30&pagina=${page}`;
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Erro ao buscar produtos no Bling: ${res.status} ${text.slice(0, 120)}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { data?: unknown[] };
    const raw = Array.isArray(data?.data) ? data.data : [];

    const products: BlingProductResult[] = [];

    for (const p of raw) {
      const item = p as Record<string, unknown>;
      const nested = item?.produto as Record<string, unknown> | undefined;

      const parentId = (item.id ?? nested?.id) as number | undefined;
      const parentSku = (item.codigo ?? nested?.codigo) as string | null;
      const parentName = (item.nome ?? nested?.nome) as string | undefined;

      if (parentId != null && parentName) {
        products.push({ id: parentId, sku: parentSku ?? null, name: parentName });
      }

      const variacoes = item?.variacoes as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(variacoes)) {
        for (const v of variacoes) {
          const vn = v?.produto as Record<string, unknown> | undefined;
          const vId = (v.id ?? vn?.id) as number | undefined;
          const vSku = (v.codigo ?? vn?.codigo) as string | null;
          const vName = (v.nome ?? vn?.nome) as string | undefined;
          if (vId != null && vName) {
            products.push({ id: vId, sku: vSku ?? null, name: vName });
          }
        }
      }
    }

    return NextResponse.json({ products, page, hasMore: !q && raw.length >= 30 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao buscar produtos no Bling.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
