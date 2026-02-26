import { NextRequest, NextResponse } from "next/server";
import { tinyApiGet, tinyApiPost, isTinyConnected, TinyTokenExpiredError } from "@/lib/tiny-api";

/**
 * Verifica se o contato existe no Tiny (por CPF/CNPJ ou celular).
 * Se não existir e o Tiny estiver conectado, cria o contato.
 * Retorna { tiny_id, found } onde found indica se já existia.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, document } = body as {
      name?: string;
      phone?: string;
      document?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Nome é obrigatório" },
        { status: 400 }
      );
    }

    const connected = await isTinyConnected();
    if (!connected) {
      return NextResponse.json({ tiny_id: null, found: false });
    }

    const docDigits = (document ?? "").replace(/\D/g, "");
    const phoneDigits = (phone ?? "").replace(/\D/g, "");

    let existingId: number | null = null;

    if (docDigits.length >= 11) {
      try {
        const res = await tinyApiGet<{ itens?: { id: number }[] }>(
          `/contatos?limit=1&cpfCnpj=${encodeURIComponent(docDigits)}`
        );
        const items = res?.itens ?? (res as any)?.data?.itens ?? [];
        if (items.length > 0 && items[0].id) {
          existingId = items[0].id;
        }
      } catch {
        // ignorar erro de busca
      }
    }

    if (existingId == null && phoneDigits.length >= 10) {
      try {
        const res = await tinyApiGet<{ itens?: { id: number }[] }>(
          `/contatos?limit=1&celular=${encodeURIComponent(phoneDigits)}`
        );
        const items = res?.itens ?? (res as any)?.data?.itens ?? [];
        if (items.length > 0 && items[0].id) {
          existingId = items[0].id;
        }
      } catch {
        // ignorar
      }
    }

    if (existingId != null) {
      return NextResponse.json({ tiny_id: existingId, found: true });
    }

    const docLen = docDigits.length;
    const tipoPessoa = docLen === 14 ? "J" : docLen === 11 ? "F" : "F";

    // API v3: tentar formato flat; fallback para formato contatos[] (API 2.0)
    const flatPayload: Record<string, unknown> = {
      nome: name.trim(),
      fantasia: name.trim(),
      tipoPessoa,
    };
    if (docDigits) flatPayload.cpfCnpj = docDigits;
    if (phoneDigits) {
      flatPayload.telefone = phoneDigits;
      flatPayload.celular = phoneDigits;
    }

    const created = await tinyApiPost<Record<string, unknown>>("/contatos", flatPayload);
    const newId =
      (created as any)?.id ??
      (created as any)?.data?.id ??
      (created as any)?.retorno?.registros?.[0]?.registro?.id ??
      (created as any)?.registros?.[0]?.id;

    if (newId) {
      return NextResponse.json({ tiny_id: Number(newId), found: false });
    }

    console.warn(
      "[Tiny create-or-find] POST retornou sem id. Resposta:",
      JSON.stringify(created).slice(0, 500)
    );
    return NextResponse.json({ tiny_id: null, found: false });
  } catch (error) {
    if (error instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { error: error.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    console.error("[Tiny create-or-find]", error);
    return NextResponse.json(
      { error: "Erro ao verificar/criar contato no Tiny" },
      { status: 500 }
    );
  }
}
