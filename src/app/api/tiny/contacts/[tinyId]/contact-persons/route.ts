import { NextRequest, NextResponse } from "next/server";
import { tinyApiGet, tinyApiPatch, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

// Tiny v3 pessoasContato fields: nome, setor, email, fone, ramal
interface TinyContactPerson {
  nome?: string;
  setor?: string;
  email?: string;
  fone?: string;
  ramal?: string;
}

interface TinyContactDetail {
  id?: number;
  nome?: string;
  pessoasContato?: TinyContactPerson[];
}

/**
 * Tiny v3 returns contact details in multiple possible shapes:
 *   { id, nome, pessoasContato, ... }          — object directly (most common)
 *   { data: { id, nome, pessoasContato, ... } } — wrapped in data
 *   { contato: { ... } }                        — legacy wrapper
 */
function extractContact(raw: unknown): TinyContactDetail {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  // Prefer explicit wrappers, fall back to the raw object itself
  return (r.data as TinyContactDetail) ?? (r.contato as TinyContactDetail) ?? (raw as TinyContactDetail);
}

// ─── GET: list contact persons ────────────────────────────────────────────────

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
    const pessoas = (contact.pessoasContato ?? []).map((p) => ({
      nome: p.nome ?? null,
      setor: p.setor ?? null,
      email: p.email ?? null,
      fone: p.fone ?? null,
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

// ─── PATCH: add or update a contact person ────────────────────────────────────
// Body: { nome: string, fone?: string }

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

    const body = await req.json() as { nome?: string; fone?: string; setor?: string };
    if (!body.nome?.trim()) {
      return NextResponse.json({ error: "nome é obrigatório" }, { status: 400 });
    }

    // 1. Fetch current contact to preserve existing pessoasContato
    let existing: TinyContactPerson[] = [];
    try {
      const raw = await tinyApiGet(`/contatos/${tinyId}`);
      console.log("[Tiny contact-persons PATCH] raw contact:", JSON.stringify(raw).slice(0, 500));
      const contact = extractContact(raw);
      existing = contact.pessoasContato ?? [];
    } catch (err) {
      console.warn("[Tiny contact-persons PATCH] Could not fetch current contact:", err);
    }

    // 2. Add or update the person
    const normName = body.nome.trim().toLowerCase();
    const idx = existing.findIndex((p) => (p.nome ?? "").toLowerCase() === normName);

    let updatedPeople: TinyContactPerson[];
    if (idx >= 0) {
      updatedPeople = existing.map((p, i) =>
        i === idx
          ? { ...p, fone: body.fone ?? p.fone, setor: body.setor ?? p.setor }
          : p
      );
    } else {
      updatedPeople = [
        ...existing,
        {
          nome: body.nome.trim(),
          fone: body.fone?.trim() || undefined,
          setor: body.setor?.trim() || undefined,
        },
      ];
    }

    // 3. PATCH the Tiny contact
    console.log("[Tiny contact-persons PATCH] sending pessoasContato:", JSON.stringify(updatedPeople));
    await tinyApiPatch(`/contatos/${tinyId}`, { pessoasContato: updatedPeople });

    return NextResponse.json({ success: true, updated: idx >= 0, totalPeople: updatedPeople.length });
  } catch (err) {
    if (err instanceof TinyTokenExpiredError) {
      return NextResponse.json({ success: false, code: "TINY_RECONNECT" }, { status: 401 });
    }
    console.error("[Tiny contact-persons PATCH]", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
