import { NextRequest, NextResponse } from "next/server";
import { tinyApiGet, tinyApiPost, tinyApiPut, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

// Tiny v3 documenta "telefone" mas na prática a API pode retornar "fone" também.
// O array de pessoas é "contatos" (V3) ou "pessoasContato" (legado).
// Ref: GET /contatos/{id} → ObterContatoModelResponse.contatos → BasePessoaContatoModel
interface TinyContactPerson {
  id?: number | null;
  nome?: string | null;
  setor?: string | null;
  email?: string | null;
  telefone?: string | null;
  fone?: string | null;
  ramal?: string | null;
}

interface TinyContactDetail {
  id?: number;
  nome?: string;
  contatos?: TinyContactPerson[];
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
      telefone: p.telefone ?? p.fone ?? null,
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

// ─── PATCH: adicionar ou atualizar pessoa de contato (CRM) ────────────────────
// A API Olist v3 NÃO oferece PATCH em /contatos/{id}. Usar:
//   - PUT /contatos/{idContato}/pessoas/{idPessoa}  (atualizar existente)
//   - POST /contatos/{idContato}/pessoas            (criar nova)
// Fallback raro: PUT /contatos/{id} com { contatos: [...] } (sem id na pessoa)
// Body: { nome: string, telefone?: string, fone?: string, setor?: string }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tinyId: string }> }
) {
  const { tinyId } = await params;
  const idContato = Number(tinyId);
  if (!Number.isFinite(idContato)) {
    return NextResponse.json({ error: "tinyId inválido" }, { status: 400 });
  }

  try {
    const connected = await isTinyConnected();
    if (!connected) {
      return NextResponse.json({ success: false, message: "Tiny não conectado" });
    }

    const body = await req.json() as { nome?: string; telefone?: string; fone?: string; setor?: string };
    if (!body.nome?.trim()) {
      return NextResponse.json({ error: "nome é obrigatório" }, { status: 400 });
    }

    const phone = body.telefone ?? body.fone;
    const nomeTrim = body.nome.trim();

    let existing: TinyContactPerson[] = [];
    try {
      const raw = await tinyApiGet(`/contatos/${idContato}`);
      console.log("[Tiny contact-persons PATCH] raw contact:", JSON.stringify(raw).slice(0, 500));
      const contact = extractContact(raw);
      existing = extractContactPersons(contact);
    } catch (err) {
      console.warn("[Tiny contact-persons PATCH] Could not fetch current contact:", err);
    }

    const normName = nomeTrim.toLowerCase();
    const idx = existing.findIndex((p) => (p.nome ?? "").toLowerCase() === normName);

    if (idx >= 0) {
      const p = existing[idx];
      const pid = p.id != null && Number.isFinite(Number(p.id)) ? Number(p.id) : null;

      if (pid != null) {
        // Olist v3: atualizar pessoa de contato
        const telefoneVal =
          (phone != null && String(phone).trim() !== "" ? String(phone).trim() : null) ??
          p.telefone ??
          p.fone ??
          undefined;
        await tinyApiPut(`/contatos/${idContato}/pessoas/${pid}`, {
          nome: nomeTrim,
          telefone: telefoneVal,
          setor: body.setor ?? p.setor ?? undefined,
          email: p.email ?? undefined,
          ramal: p.ramal ?? undefined,
        });
        return NextResponse.json({ success: true, updated: true, totalPeople: existing.length, mode: "put-pessoa" });
      }

      // Pessoa existente no array mas sem id (raro) — enviar array completo via PUT do contato
      const updatedPeople: TinyContactPerson[] = existing.map((ep, i) =>
        i === idx
          ? {
              ...ep,
              telefone: phone != null && String(phone).trim() !== "" ? String(phone).trim() : ep.telefone ?? ep.fone,
              setor: body.setor ?? ep.setor,
            }
          : ep
      );
      const contatosPayload = updatedPeople.map((x) => ({
        id: x.id ?? undefined,
        nome: x.nome ?? undefined,
        telefone: x.telefone ?? x.fone ?? undefined,
        setor: x.setor ?? undefined,
        email: x.email ?? undefined,
        ramal: x.ramal ?? undefined,
      }));
      console.log("[Tiny contact-persons PATCH] fallback PUT contatos (sem id pessoa):", JSON.stringify(contatosPayload));
      await tinyApiPut(`/contatos/${idContato}`, { contatos: contatosPayload });
      return NextResponse.json({ success: true, updated: true, totalPeople: updatedPeople.length, mode: "put-contato-fallback" });
    }

    // Nova pessoa de contato
    await tinyApiPost(`/contatos/${idContato}/pessoas`, {
      nome: nomeTrim,
      telefone: phone?.trim() || undefined,
      setor: body.setor?.trim() || undefined,
    });
    return NextResponse.json({
      success: true,
      updated: false,
      totalPeople: existing.length + 1,
      mode: "post-pessoa",
    });
  } catch (err) {
    if (err instanceof TinyTokenExpiredError) {
      return NextResponse.json({ success: false, code: "TINY_RECONNECT" }, { status: 401 });
    }
    console.error("[Tiny contact-persons PATCH]", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
