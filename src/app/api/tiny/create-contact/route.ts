import { NextRequest, NextResponse } from "next/server";
import {
  tinyApiGet,
  tinyApiPost,
  isTinyConnected,
  TinyTokenExpiredError,
} from "@/lib/tiny-api";
import {
  applySalesChannelToTinyContact,
  SALES_CHANNEL_VALUES,
  type SalesChannel,
} from "@/lib/sales-channel";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

/**
 * Cria ou localiza um contato no Tiny ERP.
 * Reutiliza a lógica de /api/tiny/contacts/create-or-find,
 * exposta nesta rota para compatibilidade com o app mobile.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      nome,
      name,
      cpf_cnpj,
      document,
      fone,
      phone,
      email,
      cidade,
      uf,
      endereco,
      cep,
      sales_channel,
    } = body as {
      nome?: string;
      name?: string;
      cpf_cnpj?: string;
      document?: string;
      fone?: string;
      phone?: string;
      email?: string;
      cidade?: string;
      uf?: string;
      endereco?: string;
      cep?: string;
      sales_channel?: SalesChannel | null;
    };

    // Valida o canal recebido (NULL/ausente = sem marcador de canal).
    const channel: SalesChannel | null =
      sales_channel &&
      (SALES_CHANNEL_VALUES as readonly string[]).includes(sales_channel)
        ? sales_channel
        : null;

    const resolvedName = (nome ?? name ?? "").trim();
    if (!resolvedName) {
      return NextResponse.json(
        { error: "nome é obrigatório" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const connected = await isTinyConnected();
    if (!connected) {
      return NextResponse.json(
        {
          success: true,
          tiny_id: null,
          found: false,
          message: "Tiny ERP não conectado",
        },
        { headers: CORS_HEADERS }
      );
    }

    const docDigits = (cpf_cnpj ?? document ?? "").replace(/\D/g, "");
    const phoneDigits = (fone ?? phone ?? "").replace(/\D/g, "");

    let existingId: number | null = null;

    // Buscar por CPF/CNPJ primeiro
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

    // Fallback: buscar por celular
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
      return NextResponse.json(
        { success: true, tiny_id: existingId, found: true },
        { headers: CORS_HEADERS }
      );
    }

    // Criar novo contato
    const docLen = docDigits.length;
    const tipoPessoa = docLen === 14 ? "J" : "F";

    const payload: Record<string, unknown> = {
      nome: resolvedName,
      fantasia: resolvedName,
      tipoPessoa,
    };
    if (docDigits) payload.cpfCnpj = docDigits;
    if (phoneDigits) {
      payload.telefone = phoneDigits;
      payload.celular = phoneDigits;
    }
    if (email) payload.email = email;
    if (endereco) payload.logradouro = endereco;
    if (cidade) payload.cidade = cidade;
    if (uf) payload.uf = uf;
    if (cep) payload.cep = cep.replace(/\D/g, "");

    // Anexa o canal (marcador `canal:<X>` + "tipo de contato" best-effort).
    // ⚠️ O formato do campo de tipos na API Tiny v3 não foi validado contra
    // resposta real — por isso há retry sem-canal: a criação NUNCA é bloqueada.
    const payloadWithChannel = applySalesChannelToTinyContact(payload, channel);

    let created: Record<string, unknown>;
    try {
      created = await tinyApiPost<Record<string, unknown>>(
        "/contatos",
        payloadWithChannel
      );
    } catch (err) {
      if (channel && !(err instanceof TinyTokenExpiredError)) {
        console.warn(
          "[tiny/create-contact] Falha com canal — retry sem canal:",
          err instanceof Error ? err.message : err
        );
        created = await tinyApiPost<Record<string, unknown>>(
          "/contatos",
          payload
        );
      } else {
        throw err;
      }
    }

    const newId =
      (created as any)?.id ??
      (created as any)?.data?.id ??
      (created as any)?.retorno?.registros?.[0]?.registro?.id ??
      (created as any)?.registros?.[0]?.id;

    if (newId) {
      return NextResponse.json(
        { success: true, tiny_id: Number(newId), found: false },
        { headers: CORS_HEADERS }
      );
    }

    console.warn(
      "[tiny/create-contact] POST retornou sem id:",
      JSON.stringify(created).slice(0, 300)
    );
    return NextResponse.json(
      { success: true, tiny_id: null, found: false },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    if (error instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { error: error.message, code: "TINY_RECONNECT" },
        { status: 401, headers: CORS_HEADERS }
      );
    }
    console.error("[tiny/create-contact]", error);
    return NextResponse.json(
      { error: error.message || "Erro ao criar contato no Tiny" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
