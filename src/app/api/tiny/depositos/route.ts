import { NextRequest, NextResponse } from "next/server";
import { tinyApiGet, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

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

    if (depositos.length === 0) {
      console.warn("[tiny/depositos] nenhum depósito encontrado", {
        attempts,
      });
    }

    return NextResponse.json({
      depositos,
      used_endpoint: usedEndpoint,
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
