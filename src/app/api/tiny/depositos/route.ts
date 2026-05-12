import { NextRequest, NextResponse } from "next/server";
import { tinyApiGet, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

interface TinyDepositoRaw {
  id?: number;
  idDeposito?: number;
  nome?: string;
  descricao?: string;
  situacao?: string;
}

interface TinyDepositoItem {
  deposito?: TinyDepositoRaw;
  [key: string]: unknown;
}

export interface TinyDepositoResult {
  id: number;
  nome: string;
  situacao: string | null;
}

function mapDeposito(raw: TinyDepositoRaw): TinyDepositoResult | null {
  const id = raw.id ?? raw.idDeposito;
  if (!id) return null;
  return {
    id,
    nome: raw.nome ?? raw.descricao ?? `Depósito ${id}`,
    situacao: raw.situacao ?? null,
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

    const response = await tinyApiGet("/depositos");

    const items: TinyDepositoItem[] =
      (response as { itens?: TinyDepositoItem[] })?.itens ??
      (response as { data?: { itens?: TinyDepositoItem[] } })?.data?.itens ??
      (response as { depositos?: TinyDepositoItem[] })?.depositos ??
      [];

    const depositos: TinyDepositoResult[] = items
      .map((item) => {
        const raw: TinyDepositoRaw =
          (item.deposito as TinyDepositoRaw) ?? (item as TinyDepositoRaw);
        return mapDeposito(raw);
      })
      .filter((d): d is TinyDepositoResult => d !== null);

    return NextResponse.json({ depositos });
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
