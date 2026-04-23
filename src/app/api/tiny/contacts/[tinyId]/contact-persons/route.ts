import { NextRequest, NextResponse } from "next/server";
import { tinyApiGet, tinyApiPatch, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

// Tiny v3 API usa "telefone" (não "fone") e o array de pessoas é "contatos" (não "pessoasContato")
// Ref: GET /contatos/{id} → ObterContatoModelResponse.contatos → PessoaContatoModel
interface TinyContactPerson {
  id?: number | null;
  nome?: string | null;
  setor?: string | null;
  email?: string | null;
  telefone?: string | null;
  ramal?: string | null;
}

interface TinyContactDetail {
  id?: number;
  nome?: string;
  // Tiny V3 usa "contatos" para pessoas de contato
  contatos?: TinyContactPerson[];
  // Fallback para eventual resposta legada
  pessoasContato?: TinyContactPerson[];
}

/**
 * Tiny v3 retorna o contato nas formas:
 *   { id, nome, contatos, ... }          — objeto direto (mais comum)
 *   { data: { id, nome, contatos, ... } } — envolvido em data
 *   { contato: { ... } }                 — wrapper legado
 */
function extractContact(raw: unknown): TinyContactDetail {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  return (r.data as TinyContactDetail) ?? (r.contato as TinyContactDetail) ?? (raw as TinyContactDetail);
}

/** Extrai o array de pessoas de contato independente do nome do campo (V3 ou legado). */
function extractContactPersons(contact: TinyContactDetail): TinyContactPerson[] {
  return contact.contatos ?? contact.pessoasContato ?? [];
}

// ─── GET: listar pessoas de contato ──────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tinyId: string }> }
) {
  const { tinyId } = await params;

  try {
    const connected = await isTinyConnected();
    if (!connected) return NextResponse.json({ pessoas: [] });

    const raw = await tinyApiGet(`/contatos/${tinyId}`);
    console.log("[Tiny contact-persons GET] raw:", JSON.stringify(raw).slice(0, 500));

    const contact = extractContact(raw);
    const pessoas = extractContactPersons(contact).map((p) => ({
      nome: p.nome ?? null,
      setor: p.setor ?? null,
      email: p.email ?? null,
      telefone: p.telefone ?? null,
      ramal: p.ramal ?? null,
    }));

    return NextResponse.json({ pessoas });
  } catch (err) {
    if (err instanceof TinyTokenExpiredError) {
      return NextResponse.json({ pessoas: [], code: "TINY_RECONNECT" }, { status: 401 });
    }
    console.error("[Tiny contact-persons GET]", err);
    return NextResponse.json({ pessoas: [], error: String(err) });
  }
}

// ─── PATCH: adicionar ou atualizar pessoa de contato ─────────────────────────
// Body: { nome: string, telefone?: string, setor?: string }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tinyId: string }> }
) {
  const { tinyId } = await params;

  try {
    const connected = await isTinyConnected();
    if (!connected) {
      return NextResponse.json({ success: false, message: "Tiny não conectado" });
    }

    const body = await req.json() as { nome?: string; telefone?: string; fone?: string; setor?: string };
    if (!body.nome?.trim()) {
      return NextResponse.json({ error: "nome é obrigatório" }, { status: 400 });
    }

    // Aceitar "fone" por compatibilidade com chamadas existentes
    const phone = body.telefone ?? body.fone;

    // 1. Buscar contato atual para preservar pessoasContato existentes
    let existing: TinyContactPerson[] = [];
    try {
      const raw = await tinyApiGet(`/contatos/${tinyId}`);
      console.log("[Tiny contact-persons PATCH] raw contact:", JSON.stringify(raw).slice(0, 500));
      const contact = extractContact(raw);
      existing = extractContactPersons(contact);
    } catch (err) {
      console.warn("[Tiny contact-persons PATCH] Could not fetch current contact:", err);
    }

    // 2. Adicionar ou atualizar a pessoa
    const normName = body.nome.trim().toLowerCase();
    const idx = existing.findIndex((p) => (p.nome ?? "").toLowerCase() === normName);

    let updatedPeople: TinyContactPerson[];
    if (idx >= 0) {
      updatedPeople = existing.map((p, i) =>
        i === idx
          ? { ...p, telefone: phone ?? p.telefone, setor: body.setor ?? p.setor }
          : p
      );
    } else {
      updatedPeople = [
        ...existing,
        {
          nome: body.nome.trim(),
          telefone: phone?.trim() || undefined,
          setor: body.setor?.trim() || undefined,
        },
      ];
    }

    // 3. PATCH no contato Tiny (V3 usa "contatos")
    console.log("[Tiny contact-persons PATCH] sending contatos:", JSON.stringify(updatedPeople));
    await tinyApiPatch(`/contatos/${tinyId}`, { contatos: updatedPeople });

    return NextResponse.json({ success: true, updated: idx >= 0, totalPeople: updatedPeople.length });
  } catch (err) {
    if (err instanceof TinyTokenExpiredError) {
      return NextResponse.json({ success: false, code: "TINY_RECONNECT" }, { status: 401 });
    }
    console.error("[Tiny contact-persons PATCH]", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
