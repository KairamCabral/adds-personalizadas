import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tinyApiGet, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";
import type { Database } from "@/types/database.types";

interface TinyDepositoRaw {
  id?: number;
  idDeposito?: number;
  nome?: string;
  descricao?: string;
  desconsiderar?: boolean;
  situacao?: string;
  empresa?: string;
}

export interface TinyDepositoResult {
  id: number;
  nome: string;
  situacao: string | null;
}

function asNum(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  return undefined;
}

function mapDeposito(raw: unknown): TinyDepositoResult | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id =
    asNum(obj.id) ?? asNum(obj.idDeposito) ?? asNum((obj as any).id_deposito);
  if (!id) return null;
  const nome =
    typeof obj.nome === "string"
      ? obj.nome
      : typeof obj.descricao === "string"
        ? obj.descricao
        : `Depósito ${id}`;
  const situacao =
    typeof obj.situacao === "string" ? obj.situacao : null;
  return { id, nome, situacao };
}

/**
 * Tenta extrair lista de depósitos do payload Tiny v3.
 * A API às vezes retorna { itens: [...] }, { data: { itens } }, { depositos: [...] }
 * ou um array puro. Cada item pode estar envelopado em { deposito: {...} }.
 */
function extractList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const candidates = [
    obj.itens,
    obj.depositos,
    (obj.data as Record<string, unknown> | undefined)?.itens,
    (obj.data as Record<string, unknown> | undefined)?.depositos,
    obj.results,
    (obj.empresa as Record<string, unknown> | undefined)?.depositos,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function normalizeItems(list: unknown[]): TinyDepositoResult[] {
  return list
    .map((item) => {
      if (item && typeof item === "object" && "deposito" in item) {
        return mapDeposito((item as { deposito: unknown }).deposito);
      }
      return mapDeposito(item);
    })
    .filter((d): d is TinyDepositoResult => d !== null);
}

// Endpoints Tiny v3 conhecidos para depósitos (tentamos em ordem)
const ENDPOINTS = ["/depositos", "/depositos/pesquisa", "/empresa/depositos"];

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Fallback: quando /depositos retorna 403 (escopo OAuth não permitido),
 * extrai a lista de depósitos lendo `depositos[]` retornado em /produtos/{id}.
 * Basta UM produto pra ter todos os depósitos cadastrados na conta.
 */
/**
 * Procura recursivamente arrays cujos itens parecem depósitos
 * (objetos com `id` numérico e `nome`/`descricao`) em qualquer profundidade.
 */
function findDepositosDeep(value: unknown, depth = 0): unknown[] {
  if (depth > 6) return [];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    const looksLikeDeposito = value.some(
      (item) =>
        item != null &&
        typeof item === "object" &&
        ("nome" in item || "descricao" in item) &&
        ("id" in item || "idDeposito" in item || "id_deposito" in item)
    );
    if (looksLikeDeposito) return value;
    return value.flatMap((v) => findDepositosDeep(v, depth + 1));
  }
  return Object.values(value as Record<string, unknown>).flatMap((v) =>
    findDepositosDeep(v, depth + 1)
  );
}

function describeShape(value: unknown, depth = 0): string {
  if (depth > 2) return "…";
  if (Array.isArray(value)) {
    return `Array(${value.length})${
      value[0] !== undefined ? `<${describeShape(value[0], depth + 1)}>` : ""
    }`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).slice(0, 12);
    return `{${keys.join(",")}}`;
  }
  return typeof value;
}

const PRODUCT_FALLBACK_PATHS = [
  "/produtos/{id}/estoque",
  "/produtos/{id}",
];

async function fetchDepositosViaProducts(
  attempts: Array<{ endpoint: string; ok: boolean; hint?: string }>
): Promise<{ depositos: TinyDepositoResult[]; source: string }> {
  const admin = getServiceClient();
  const { data: products } = await admin
    .from("products")
    .select("id, name, tiny_id")
    .not("tiny_id", "is", null)
    .eq("is_active", true)
    .limit(3);

  if (!products || products.length === 0) {
    return { depositos: [], source: "no_products_with_tiny_id" };
  }

  const seen = new Map<number, TinyDepositoResult>();
  let usedSource: string | null = null;

  for (const p of products) {
    if (!p.tiny_id) continue;

    for (const pathTemplate of PRODUCT_FALLBACK_PATHS) {
      const endpoint = pathTemplate.replace("{id}", String(p.tiny_id));
      try {
        const raw = await tinyApiGet<unknown>(endpoint);
        const found = findDepositosDeep(raw);
        const mappedHere: TinyDepositoResult[] = [];
        for (const d of found) {
          const mapped = mapDeposito(d);
          if (mapped && !seen.has(mapped.id)) {
            seen.set(mapped.id, mapped);
            mappedHere.push(mapped);
          }
        }
        attempts.push({
          endpoint: `${endpoint} (${p.name})`,
          ok: true,
          hint:
            mappedHere.length > 0
              ? `${mappedHere.length} depósito(s) encontrado(s)`
              : `shape=${describeShape(raw)}`,
        });
        if (mappedHere.length > 0 && !usedSource) {
          usedSource = `via:${p.name}`;
        }
        if (seen.size > 0) break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        attempts.push({
          endpoint: `${endpoint} (${p.name})`,
          ok: false,
          hint: msg.slice(0, 160),
        });
        if (err instanceof TinyTokenExpiredError) throw err;
      }
    }
    if (seen.size > 0) break;
  }

  return {
    depositos: Array.from(seen.values()),
    source: usedSource ?? "no_depositos_in_products",
  };
}

export async function GET(_request: NextRequest) {
  try {
    const connected = await isTinyConnected();
    if (!connected) {
      return NextResponse.json(
        { depositos: [], error: "Tiny ERP não conectado.", code: "TINY_NOT_CONNECTED" },
        { status: 422 }
      );
    }

    const attempts: Array<{ endpoint: string; ok: boolean; hint?: string; raw?: unknown }> = [];
    let depositos: TinyDepositoResult[] = [];
    let usedEndpoint: string | null = null;

    for (const endpoint of ENDPOINTS) {
      try {
        const response = await tinyApiGet(endpoint);
        const list = extractList(response);
        const mapped = normalizeItems(list);
        attempts.push({
          endpoint,
          ok: true,
          hint:
            list.length === 0
              ? `payload sem array reconhecível (keys: ${
                  response && typeof response === "object"
                    ? Object.keys(response).join(",")
                    : typeof response
                })`
              : `${list.length} item(ns), ${mapped.length} mapeado(s)`,
          raw: mapped.length === 0 ? response : undefined,
        });
        if (mapped.length > 0) {
          depositos = mapped;
          usedEndpoint = endpoint;
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        attempts.push({ endpoint, ok: false, hint: msg.slice(0, 200) });
        if (err instanceof TinyTokenExpiredError) throw err;
        // 404 ou similar — tenta o próximo
      }
    }

    // Fallback: se nenhum endpoint direto funcionou (típico de 403 sem
    // escopo OAuth p/ depósitos), extrai a lista de produtos sincronizados.
    let fallbackSource: string | null = null;
    if (depositos.length === 0) {
      try {
        const fb = await fetchDepositosViaProducts(attempts);
        if (fb.depositos.length > 0) {
          depositos = fb.depositos;
          fallbackSource = fb.source;
        }
      } catch (err) {
        if (err instanceof TinyTokenExpiredError) throw err;
      }
    }

    if (depositos.length === 0) {
      console.warn("[tiny/depositos] nenhum depósito encontrado", { attempts });
    }

    return NextResponse.json({
      depositos: depositos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      used_endpoint: usedEndpoint ?? fallbackSource,
      attempts: depositos.length === 0 ? attempts : undefined,
    });
  } catch (error) {
    if (error instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { depositos: [], error: error.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[tiny/depositos]", err.message);
    return NextResponse.json({ depositos: [], error: err.message }, { status: 500 });
  }
}
