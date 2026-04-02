import { NextRequest, NextResponse } from "next/server";
import { tinyApiGet, tinyApiPatch, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

interface TinyContactPerson {
  nome?: string;
  cargo?: string;
  email?: string;
  fone?: string;
  celular?: string;
}

interface TinyContactDetail {
  id?: number;
  nome?: string;
  pessoasContato?: TinyContactPerson[];
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

    const data = await tinyApiGet<{ data?: TinyContactDetail; contato?: TinyContactDetail }>(
      `/contatos/${tinyId}`
    );
    const contact: TinyContactDetail = data?.data ?? (data as any)?.contato ?? {};
    const pessoas = (contact.pessoasContato ?? []).map((p) => ({
      nome: p.nome ?? null,
      cargo: p.cargo ?? null,
      email: p.email ?? null,
      fone: p.fone ?? null,
      celular: p.celular ?? null,
    }));

    return NextResponse.json({ pessoas });
  } catch (err) {
    if (err instanceof TinyTokenExpiredError) {
      return NextResponse.json({ pessoas: [], code: "TINY_RECONNECT" }, { status: 401 });
    }
    console.error("[Tiny contact-persons GET]", err);
    return NextResponse.json({ pessoas: [] });
  }
}

// ─── PATCH: add or update a contact person ────────────────────────────────────
// Body: { nome: string, celular?: string, fone?: string, cargo?: string }

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

    const body = await req.json() as TinyContactPerson;
    if (!body.nome?.trim()) {
      return NextResponse.json({ error: "nome é obrigatório" }, { status: 400 });
    }

    // 1. Fetch current contact to preserve existing pessoasContato
    let currentContact: TinyContactDetail = {};
    try {
      const data = await tinyApiGet<{ data?: TinyContactDetail; contato?: TinyContactDetail }>(
        `/contatos/${tinyId}`
      );
      currentContact = data?.data ?? (data as any)?.contato ?? {};
    } catch (err) {
      console.warn("[Tiny contact-persons PATCH] Couldn't fetch current contact:", err);
    }

    const existing = currentContact.pessoasContato ?? [];

    // 2. Check if a person with this name already exists — update their phone if so
    const normName = body.nome.trim().toLowerCase();
    const idx = existing.findIndex((p) => (p.nome ?? "").toLowerCase() === normName);

    let updatedPeople: TinyContactPerson[];
    if (idx >= 0) {
      // Update existing entry
      updatedPeople = existing.map((p, i) =>
        i === idx
          ? { ...p, celular: body.celular ?? p.celular, fone: body.fone ?? p.fone, cargo: body.cargo ?? p.cargo }
          : p
      );
    } else {
      // Append new entry
      updatedPeople = [
        ...existing,
        {
          nome: body.nome.trim(),
          celular: body.celular?.trim() || undefined,
          fone: body.fone?.trim() || undefined,
          cargo: body.cargo?.trim() || undefined,
        },
      ];
    }

    // 3. PATCH the Tiny contact with updated pessoasContato
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
