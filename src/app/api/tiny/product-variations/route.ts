import { NextRequest, NextResponse } from "next/server";
import { tinyApiGet, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

export interface TinyVariationResult {
  id: number;
  name: string;
  sku: string | null;
  gradeLabel: string | null;
}

export async function GET(request: NextRequest) {
  const parentId = request.nextUrl.searchParams.get("parent_id");

  if (!parentId) {
    return NextResponse.json({ error: "parent_id é obrigatório." }, { status: 400 });
  }

  try {
    const connected = await isTinyConnected();
    if (!connected) {
      return NextResponse.json(
        { variations: [], error: "Tiny ERP não conectado." },
        { status: 422 }
      );
    }

    const response = await tinyApiGet(`/produtos/${parentId}`);

    // Tiny v3 pode retornar { data: {...} } ou diretamente o objeto
    const product = (response as any)?.data ?? (response as any);

    // Tiny v3 usa "descricao" como nome principal (não "nome")
    const parentName: string = product?.descricao ?? product?.nome ?? "Produto";
    const rawVariacoes: unknown[] = Array.isArray(product?.variacoes)
      ? product.variacoes
      : [];

    const variations: TinyVariationResult[] = rawVariacoes.map((v: any) => {
      // grade = [{ chave: "Cor", valor: "Amarelo" }]
      const grade: { chave?: string; valor?: string }[] = Array.isArray(v.grade)
        ? v.grade
        : [];
      const gradeLabel = grade.map((g) => g.valor).filter(Boolean).join(" / ") || null;

      return {
        id: v.id ?? 0,
        // Tiny v3 usa "descricao" para variações, não "nome"
        name: v.descricao ?? v.nome ?? parentName,
        // Tiny v3 usa "sku" nas variações (não "codigo")
        sku: v.sku ?? v.codigo ?? null,
        gradeLabel,
      };
    }).filter((v) => v.id > 0);

    return NextResponse.json({ variations, parentName });
  } catch (error) {
    if (error instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { variations: [], error: error.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[tiny/product-variations]", msg);
    return NextResponse.json({ variations: [], error: msg }, { status: 500 });
  }
}
