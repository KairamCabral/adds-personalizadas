import { NextRequest, NextResponse } from "next/server";
import { tinyApiGet, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

/** Exclui contatos internos/financeiros (prolabore, salário, etc.) da busca. */
function isInternalOrFinancialContact(name: string | null, company: string | null): boolean {
  const text = [name, company].filter(Boolean).join(" ").toUpperCase();
  if (!text) return false;
  const patterns = [
    /\bPR[OÓ]\s*-?\s*LABORE\b/,
    /\bPROLABORE\b/,
    /\bSAL[ÁA]RIO\s+/,
    /\bDIVIDENDO\s+/,
    /\bS[OÓ]CIO\s+/,
    /\bRETIRADA\s+/,
    /\bFGTS\b/,
    /\bINSS\b/,
    /\bIMPOSTO\b/,
  ];
  return patterns.some((p) => p.test(text));
}

export interface TinyContactSearchResult {
  id: number;
  nome: string;
  nomeFantasia?: string;
  email?: string;
  fone?: string;
  celular?: string;
  cpfCnpj?: string;
  tipoPessoa?: string;
  endereco?: {
    cidade?: string;
    uf?: string;
    cep?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    complemento?: string;
  };
}

export interface ContactSearchItem {
  id: string;
  tiny_id?: number;
  name: string;
  phone: string | null;
  document: string | null;
  company: string | null;
  source: "crm" | "tiny";
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ items: [] });
  }

  try {
    const connected = await isTinyConnected();
    let tinyItems: ContactSearchItem[] = [];
    const digitsOnly = q.replace(/\D/g, "");
    const isDigitsSearch = digitsOnly.length >= 10 && /^\d+$/.test(digitsOnly);

    if (connected) {
      try {
        let contacts: TinyContactSearchResult[] = [];
        if (isDigitsSearch) {
          const [byCpf, byCel] = await Promise.all([
            tinyApiGet<{ itens?: TinyContactSearchResult[]; data?: { itens?: TinyContactSearchResult[] } }>(
              `/contatos?limit=20&offset=0&cpfCnpj=${encodeURIComponent(digitsOnly)}`
            ),
            tinyApiGet<{ itens?: TinyContactSearchResult[]; data?: { itens?: TinyContactSearchResult[] } }>(
              `/contatos?limit=20&offset=0&celular=${encodeURIComponent(digitsOnly)}`
            ),
          ]);
          const fromCpf = byCpf?.itens ?? byCpf?.data?.itens ?? [];
          const fromCel = byCel?.itens ?? byCel?.data?.itens ?? [];
          const seen = new Set<number>();
          for (const c of [...fromCpf, ...fromCel]) {
            if (c.id && !seen.has(c.id)) {
              seen.add(c.id);
              contacts.push(c);
            }
          }
        }
        if (contacts.length === 0) {
          const response = await tinyApiGet<{
            itens?: TinyContactSearchResult[];
            data?: { itens?: TinyContactSearchResult[] };
          }>(`/contatos?limit=20&offset=0&nome=${encodeURIComponent(q)}`);
          contacts = response?.itens ?? response?.data?.itens ?? [];
        }
        tinyItems = contacts
          .filter(
            (c: { nome?: string; nomeFantasia?: string }) =>
              !isInternalOrFinancialContact(c.nome ?? null, c.nomeFantasia ?? null)
          )
          .map((c) => ({
          id: `tiny-${c.id}`,
          tiny_id: c.id,
          name: c.nome || c.nomeFantasia || "Sem nome",
          phone: (c.fone || c.celular) ?? null,
          document: c.cpfCnpj ?? null,
          company: c.nomeFantasia ?? null,
          source: "tiny" as const,
        }));
      } catch (err) {
        console.warn("[Tiny contacts search] Tiny API error:", err);
      }
    }

    return NextResponse.json({ items: tinyItems });
  } catch (error) {
    if (error instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { items: [], error: error.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    console.error("[Tiny contacts search]", error);
    return NextResponse.json({ items: [] });
  }
}
