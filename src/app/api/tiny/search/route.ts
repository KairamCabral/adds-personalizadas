import { NextRequest, NextResponse } from "next/server";
import { tinyApiGet, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

function isInternalOrFinancialContact(
  name: string | null,
  company: string | null
): boolean {
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

interface TinyContactRaw {
  id?: number;
  nome?: string;
  nomeFantasia?: string;
  email?: string;
  fone?: string;
  celular?: string;
  cpfCnpj?: string;
  endereco?: { cidade?: string; uf?: string };
}

export interface TinySearchContact {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  source: "tiny";
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ contacts: [] });
  }

  try {
    const connected = await isTinyConnected();
    const contacts: TinySearchContact[] = [];
    const digitsOnly = q.replace(/\D/g, "");
    const isDigitsSearch = digitsOnly.length >= 10 && /^\d+$/.test(digitsOnly);

    if (connected) {
      try {
        let raw: TinyContactRaw[] = [];
        if (isDigitsSearch) {
          const [byCpf, byCel] = await Promise.all([
            tinyApiGet<{ itens?: TinyContactRaw[]; data?: { itens?: TinyContactRaw[] } }>(
              `/contatos?limit=20&offset=0&cpfCnpj=${encodeURIComponent(digitsOnly)}`
            ),
            tinyApiGet<{ itens?: TinyContactRaw[]; data?: { itens?: TinyContactRaw[] } }>(
              `/contatos?limit=20&offset=0&celular=${encodeURIComponent(digitsOnly)}`
            ),
          ]);
          const fromCpf = byCpf?.itens ?? byCpf?.data?.itens ?? [];
          const fromCel = byCel?.itens ?? byCel?.data?.itens ?? [];
          const seen = new Set<number>();
          for (const c of [...fromCpf, ...fromCel]) {
            if (c.id && !seen.has(c.id)) {
              seen.add(c.id);
              raw.push(c);
            }
          }
        }
        if (raw.length === 0) {
          const response = await tinyApiGet<{
            itens?: TinyContactRaw[];
            data?: { itens?: TinyContactRaw[] };
          }>(`/contatos?limit=20&offset=0&nome=${encodeURIComponent(q)}`);
          raw = response?.itens ?? response?.data?.itens ?? [];
        }
        for (const c of raw) {
          if (isInternalOrFinancialContact(c.nome ?? null, c.nomeFantasia ?? null))
            continue;
          contacts.push({
            id: `tiny-${c.id ?? ""}`,
            name: c.nome || c.nomeFantasia || "Sem nome",
            document: c.cpfCnpj ?? null,
            email: c.email ?? null,
            phone: (c.fone || c.celular) ?? null,
            city: c.endereco?.cidade ?? null,
            state: c.endereco?.uf ?? null,
            source: "tiny",
          });
        }
      } catch (err) {
        console.warn("[Tiny search] Tiny API error:", err);
      }
    }

    return NextResponse.json({ contacts });
  } catch (error) {
    if (error instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { contacts: [], error: error.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    console.error("[Tiny search]", error);
    return NextResponse.json({ contacts: [] });
  }
}
