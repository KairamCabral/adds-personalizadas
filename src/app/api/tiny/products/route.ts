import { NextRequest, NextResponse } from "next/server";
import { tinyApiGet, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

interface TinyProductRaw {
  id?: number;
  nome?: string;
  descricao?: string;
  codigo?: string;
  preco?: number | string;
  precoCusto?: number | string;
  preco_custo?: number | string;
  estoque?: number | string;
  saldo?: number | string;
  tipo?: string;
  unidade?: string;
  categoria?: { nome?: string };
  // produto pai / variante
  idProdutoPai?: number;
  nomeProdutoPai?: string;
}

interface TinyProductItem {
  produto?: TinyProductRaw;
  [key: string]: unknown;
}

export interface TinyProductResult {
  id: number;
  name: string;
  sku: string | null;
  price: number | null;
  cost_price: number | null;
  stock: number | null;
  tipo: string | null;
  parent_id: number | null;
  parent_name: string | null;
}

function parseNum(value: number | string | undefined | null): number | null {
  if (value == null) return null;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(n) ? null : n;
}

function mapProduct(raw: TinyProductRaw): TinyProductResult {
  return {
    id: raw.id ?? 0,
    name: raw.nome ?? raw.descricao ?? "Sem nome",
    sku: raw.codigo || null,
    price: parseNum(raw.preco),
    cost_price: parseNum(raw.precoCusto ?? raw.preco_custo),
    stock: parseNum(raw.estoque ?? raw.saldo),
    tipo: raw.tipo ?? null,
    parent_id: raw.idProdutoPai ?? null,
    parent_name: raw.nomeProdutoPai ?? null,
  };
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "50"), 100);

  try {
    const connected = await isTinyConnected();
    if (!connected) {
      return NextResponse.json(
        { products: [], error: "Tiny ERP não conectado. Configure em Configurações > Integrações." },
        { status: 422 }
      );
    }

    const endpoint = q.length >= 2
      ? `/produtos?limit=${limit}&offset=0&nome=${encodeURIComponent(q)}`
      : `/produtos?limit=${limit}&offset=0`;

    const response = await tinyApiGet(endpoint);

    const items: TinyProductItem[] =
      (response as any)?.itens ??
      (response as any)?.data?.itens ??
      (response as any)?.produtos ??
      [];

    const products: TinyProductResult[] = items.map((item) => {
      const raw: TinyProductRaw = (item.produto as TinyProductRaw) ?? (item as TinyProductRaw);
      return mapProduct(raw);
    }).filter((p) => p.id > 0);

    return NextResponse.json({ products });
  } catch (error) {
    if (error instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { products: [], error: error.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[tiny/products]", err.message);
    return NextResponse.json({ products: [], error: err.message }, { status: 500 });
  }
}
