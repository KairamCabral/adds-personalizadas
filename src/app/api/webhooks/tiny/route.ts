/**
 * Webhook Tiny ERP
 *
 * URL para configurar no painel Tiny (todas as 4 notificações):
 *   {NEXT_PUBLIC_APP_URL}/api/webhooks/tiny
 *
 * O Tiny envia POST com Content-Type: application/x-www-form-urlencoded
 * onde o campo `dados` é uma string JSON e `tipo` é uma string simples.
 *
 * Eventos tratados:
 *  - pedido         → atualiza status do pedido
 *  - notaFiscal     → vincula NF e marca como FATURADO
 *  - produto        → atualiza estoque e preço
 *  - contato        → atualiza cadastro do cliente
 *
 * Segurança: defina TINY_WEBHOOK_SECRET no .env com qualquer
 * string e appende como ?token=XXX na URL configurada no Tiny.
 * O endpoint validará o parâmetro. Se a env não estiver definida,
 * a validação é ignorada (OK para desenvolvimento).
 *
 * Relay: defina TINY_RELAY_URL no .env com a URL original que
 * recebia os webhooks do Tiny (ex: https://webhooks.notificacoesinteligentes.com/...).
 * O payload original será encaminhado para essa URL após o processamento,
 * mantendo seu app de mensagens funcionando sem alterações.
 * Múltiplas URLs são suportadas separadas por vírgula.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// ============================================================
// CLIENTE SUPABASE (service role — sem RLS)
// ============================================================

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================
// MAPEAMENTO DE STATUS
// ============================================================

const TINY_SITUACAO_TO_STATUS: Record<
  string,
  Database["public"]["Enums"]["order_status"]
> = {
  // Pedidos
  "Em aberto": "FAZER",
  "Aprovado": "APROVADO",
  "Em andamento": "PRODUCAO",
  "Preparando envio": "EXPEDICAO",
  "Faturado": "FATURADO",
  "Cancelado": "ARQUIVADO",
  // Notas fiscais: "Autorizada" → FATURADO
  "Autorizada": "FATURADO",
};

// ============================================================
// PARSE DO PAYLOAD TINY
// Tiny V2 envia form-encoded: dados=<JSON string>&tipo=pedido
// Tiny V3 pode enviar JSON diretamente.
// Suportamos ambos.
// ============================================================

interface TinyPayload {
  tipo: string;
  dados: Record<string, unknown>;
}

interface ParseResult {
  payload: TinyPayload | null;
  /** Corpo bruto original — usado para repassar ao relay sem modificação */
  rawBody: string;
  /** Content-Type original */
  contentType: string;
}

async function parsePayload(request: NextRequest): Promise<ParseResult> {
  const contentType = request.headers.get("content-type") ?? "";
  const rawBody = await request.text();

  try {
    if (contentType.includes("application/json")) {
      const body = JSON.parse(rawBody);
      const dados =
        typeof body.dados === "string" ? JSON.parse(body.dados) : (body.dados ?? body);
      return { payload: { tipo: body.tipo ?? "", dados }, rawBody, contentType };
    }

    // application/x-www-form-urlencoded (padrão Tiny V2)
    const params = new URLSearchParams(rawBody);
    const tipo = params.get("tipo") ?? "";
    const dadosRaw = params.get("dados") ?? "{}";
    const dados = JSON.parse(dadosRaw) as Record<string, unknown>;

    return { payload: { tipo, dados }, rawBody, contentType };
  } catch (err) {
    console.error("[Webhook Tiny] Erro ao parsear payload:", err);
    return { payload: null, rawBody, contentType };
  }
}

/**
 * Encaminha o payload bruto para as URLs de relay configuradas em TINY_RELAY_URL.
 * Executa em background (fire-and-forget) sem bloquear a resposta.
 */
async function relayWebhook(rawBody: string, contentType: string) {
  const relayEnv = process.env.TINY_RELAY_URL;
  if (!relayEnv) return;

  const relayUrls = relayEnv
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  await Promise.allSettled(
    relayUrls.map((url) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: rawBody,
        signal: AbortSignal.timeout(8000),
      }).then((res) => {
        if (!res.ok) {
          console.warn(`[Webhook Tiny] Relay para ${url} respondeu ${res.status}`);
        } else {
          console.info(`[Webhook Tiny] Relay para ${url} OK`);
        }
      })
    )
  );
}

// ============================================================
// HELPERS
// ============================================================

async function logSync(
  supabase: ReturnType<typeof getServiceClient>,
  params: {
    entity_type: string;
    entity_id?: string | null;
    tiny_id?: number | null;
    direction: string;
    status: "success" | "error";
    error_message?: string | null;
  }
) {
  await supabase.from("tiny_sync_logs").insert({
    entity_type: params.entity_type,
    entity_id: params.entity_id ?? null,
    tiny_id: params.tiny_id ?? null,
    direction: params.direction,
    status: params.status,
    error_message: params.error_message ?? null,
  });
}

// ============================================================
// PROCESSADORES POR TIPO
// ============================================================

/** pedido — notificação de venda ou pedido enviado */
async function handlePedido(
  supabase: ReturnType<typeof getServiceClient>,
  dados: Record<string, unknown>
) {
  const tinyOrderId = Number(dados.id ?? dados.idPedido);
  if (!tinyOrderId) return { ok: false, message: "ID do pedido ausente." };

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, tiny_invoice_id")
    .eq("tiny_order_id", tinyOrderId)
    .maybeSingle();

  if (!order) {
    await logSync(supabase, {
      entity_type: "order",
      tiny_id: tinyOrderId,
      direction: "pull",
      status: "error",
      error_message: `Pedido tiny_order_id=${tinyOrderId} não encontrado no CRM.`,
    });
    return {
      ok: false,
      message: `Pedido tiny_order_id=${tinyOrderId} não encontrado localmente.`,
    };
  }

  const updates: Database["public"]["Tables"]["orders"]["Update"] = {};

  // Mapear situação Tiny → status CRM
  const situacao = (dados.situacao as string | undefined) ?? "";
  if (situacao) {
    const mappedStatus = TINY_SITUACAO_TO_STATUS[situacao];
    if (mappedStatus && mappedStatus !== order.status) {
      updates.status = mappedStatus;
    }
  }

  // Nota fiscal incluída no evento de pedido
  const idNotaFiscal = dados.idNotaFiscal
    ? Number(dados.idNotaFiscal)
    : undefined;
  if (idNotaFiscal && idNotaFiscal !== order.tiny_invoice_id) {
    updates.tiny_invoice_id = idNotaFiscal;
    if (!updates.status) updates.status = "FATURADO";
  }

  if (Object.keys(updates).length === 0) {
    await logSync(supabase, {
      entity_type: "order",
      entity_id: order.id,
      tiny_id: tinyOrderId,
      direction: "pull",
      status: "success",
    });
    return { ok: true, message: "Pedido já sincronizado, sem alterações." };
  }

  updates.updated_at = new Date().toISOString();
  const { error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", order.id);

  await logSync(supabase, {
    entity_type: "order",
    entity_id: order.id,
    tiny_id: tinyOrderId,
    direction: "pull",
    status: error ? "error" : "success",
    error_message: error?.message ?? null,
  });

  return {
    ok: !error,
    message: error
      ? `Erro ao atualizar pedido: ${error.message}`
      : `Pedido ${order.id} atualizado (${Object.keys(updates).join(", ")}).`,
  };
}

/** notaFiscal — nota fiscal autorizada → marca pedido como FATURADO */
async function handleNotaFiscal(
  supabase: ReturnType<typeof getServiceClient>,
  dados: Record<string, unknown>
) {
  const tinyNfId = dados.id ? Number(dados.id) : undefined;
  // A NF pode vir com idPedido ou numero do pedido
  const tinyOrderId = dados.idPedido
    ? Number(dados.idPedido)
    : dados.pedido
      ? Number((dados.pedido as Record<string, unknown>).id)
      : undefined;

  if (!tinyOrderId) {
    // Sem pedido vinculado — só registrar
    console.info("[Webhook Tiny] NF sem pedido vinculado:", tinyNfId);
    return {
      ok: true,
      message: `NF #${tinyNfId} recebida mas sem pedido vinculado.`,
    };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("tiny_order_id", tinyOrderId)
    .maybeSingle();

  if (!order) {
    await logSync(supabase, {
      entity_type: "invoice",
      tiny_id: tinyNfId ?? tinyOrderId,
      direction: "pull",
      status: "error",
      error_message: `Pedido tiny_order_id=${tinyOrderId} não encontrado para vincular NF.`,
    });
    return { ok: false, message: "Pedido não encontrado para vincular NF." };
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: "FATURADO",
      tiny_invoice_id: tinyNfId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  await logSync(supabase, {
    entity_type: "invoice",
    entity_id: order.id,
    tiny_id: tinyNfId ?? tinyOrderId,
    direction: "pull",
    status: error ? "error" : "success",
    error_message: error?.message ?? null,
  });

  return {
    ok: !error,
    message: error
      ? `Erro ao faturar pedido: ${error.message}`
      : `Pedido ${order.id} marcado como FATURADO (NF #${tinyNfId}).`,
  };
}

/** produto — atualiza estoque e preço (lançamento de estoque) */
async function handleProduto(
  supabase: ReturnType<typeof getServiceClient>,
  dados: Record<string, unknown>
) {
  const tinyProductId = dados.id ? Number(dados.id) : undefined;
  if (!tinyProductId) return { ok: false, message: "ID do produto ausente." };

  const updates: Record<string, unknown> = {
    tiny_synced_at: new Date().toISOString(),
  };

  if (dados.estoque !== undefined) {
    updates.stock = Number(dados.estoque) || 0;
  }
  // estoquePosicao aparece em lançamentos de estoque
  if (dados.estoquePosicao !== undefined) {
    updates.stock = Number(dados.estoquePosicao) || 0;
  }
  if (dados.preco !== undefined) {
    const price = Number(dados.preco);
    if (!isNaN(price) && price > 0) updates.price = price;
  }
  if (dados.nome) updates.name = dados.nome;
  if (dados.descricao) updates.description = dados.descricao;

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("tiny_id", tinyProductId)
    .maybeSingle();

  let error: { message: string } | null = null;
  let entityId: string | null = null;

  if (product) {
    entityId = product.id;
    const { error: upErr } = await supabase
      .from("products")
      .update(updates as any)
      .eq("id", product.id);
    error = upErr;
  } else if (dados.nome) {
    // Criar produto se não existir localmente
    const { data: created, error: insErr } = await supabase
      .from("products")
      .insert({
        name: dados.nome as string,
        stock: Number(dados.estoque ?? dados.estoquePosicao) || 0,
        price: dados.preco ? Number(dados.preco) : null,
        tiny_id: tinyProductId,
        tiny_synced_at: new Date().toISOString(),
      } as any)
      .select("id")
      .single();
    error = insErr;
    entityId = created?.id ?? null;
  }

  await logSync(supabase, {
    entity_type: "product",
    entity_id: entityId,
    tiny_id: tinyProductId,
    direction: "pull",
    status: error ? "error" : "success",
    error_message: error?.message ?? null,
  });

  return {
    ok: !error,
    message: error
      ? `Erro ao atualizar produto ${tinyProductId}: ${error.message}`
      : `Produto ${entityId ?? tinyProductId} sincronizado (stock=${updates.stock ?? "—"}).`,
  };
}

/** contato — atualiza dados cadastrais do cliente */
async function handleContato(
  supabase: ReturnType<typeof getServiceClient>,
  dados: Record<string, unknown>
) {
  const tinyContactId = dados.id ? Number(dados.id) : undefined;
  if (!tinyContactId) return { ok: false, message: "ID do contato ausente." };

  const endereco = (dados.endereco as Record<string, unknown>) ?? {};

  const clientData: Record<string, unknown> = {
    tiny_synced_at: new Date().toISOString(),
  };

  if (dados.nome) clientData.name = dados.nome;
  if (dados.nomeFantasia) clientData.company = dados.nomeFantasia;
  if (dados.email) clientData.email = dados.email;
  if (dados.fone || dados.celular) {
    clientData.phone = (dados.fone ?? dados.celular) as string;
  }
  if (dados.cpfCnpj) clientData.document = dados.cpfCnpj;
  if (dados.tipoPessoa) {
    clientData.person_type =
      dados.tipoPessoa === "J" ? "JURIDICA" : "FISICA";
  }
  if (endereco.cidade) clientData.city = endereco.cidade;
  if (endereco.uf) clientData.state = endereco.uf;
  if (endereco.cep) clientData.zip_code = (endereco.cep as string).replace(/\D/g, "");
  if (endereco.endereco) clientData.street = endereco.endereco;
  if (endereco.numero) clientData.number = endereco.numero;
  if (endereco.complemento) clientData.complement = endereco.complemento;
  if (endereco.bairro) clientData.neighborhood = endereco.bairro;

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("tiny_id", tinyContactId)
    .maybeSingle();

  let error: { message: string } | null = null;
  let entityId: string | null = null;

  if (client) {
    entityId = client.id;
    const { error: upErr } = await supabase
      .from("clients")
      .update(clientData as any)
      .eq("id", client.id);
    error = upErr;
  } else if (dados.nome) {
    const { data: created, error: insErr } = await supabase
      .from("clients")
      .insert({
        ...clientData,
        name: dados.nome as string,
        tiny_id: tinyContactId,
      } as any)
      .select("id")
      .single();
    error = insErr;
    entityId = created?.id ?? null;
  }

  await logSync(supabase, {
    entity_type: "client",
    entity_id: entityId,
    tiny_id: tinyContactId,
    direction: "pull",
    status: error ? "error" : "success",
    error_message: error?.message ?? null,
  });

  return {
    ok: !error,
    message: error
      ? `Erro ao atualizar contato ${tinyContactId}: ${error.message}`
      : `Contato ${entityId ?? tinyContactId} sincronizado.`,
  };
}

// ============================================================
// ROUTE HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  // ── 1. Validação por token na URL (?token=...)  ────────────
  // Configure a URL no painel Tiny como:
  //   https://crm.addsbrasil.com.br/api/webhooks/tiny?token=SEU_TOKEN
  // E defina TINY_WEBHOOK_SECRET=SEU_TOKEN no .env
  const webhookSecret = process.env.TINY_WEBHOOK_SECRET;
  if (webhookSecret) {
    const urlToken = request.nextUrl.searchParams.get("token");
    const bodyToken = request.headers
      .get("authorization")
      ?.replace("Bearer ", "");

    if (urlToken !== webhookSecret && bodyToken !== webhookSecret) {
      console.warn("[Webhook Tiny] Token inválido. Recebido:", urlToken);
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  // ── 2. Parse do payload (form-encoded ou JSON) ─────────────
  const { payload, rawBody, contentType } = await parsePayload(request);
  if (!payload) {
    return NextResponse.json(
      { error: "Payload inválido ou malformado." },
      { status: 400 }
    );
  }

  // ── 3. Relay para app externo (fire-and-forget) ────────────
  // Repassa o payload bruto para TINY_RELAY_URL sem bloquear a resposta.
  relayWebhook(rawBody, contentType).catch((err) =>
    console.error("[Webhook Tiny] Erro no relay:", err)
  );

  // ── 4. Roteamento por tipo ─────────────────────────────────
  const supabase = getServiceClient();
  const tipo = payload.tipo.toLowerCase().replace(/\s/g, "");
  const dados = payload.dados;

  console.info(`[Webhook Tiny] tipo="${tipo}" | relay=${!!process.env.TINY_RELAY_URL}`);

  let result: { ok: boolean; message: string };

  switch (tipo) {
    case "pedido":
    case "pedidoenviado":   // "Receber notificações de pedidos enviados"
      result = await handlePedido(supabase, dados);
      break;

    case "notafiscal":
    case "nota_fiscal":
    case "nfe":
      result = await handleNotaFiscal(supabase, dados);
      break;

    case "produto":
    case "estoque":
    case "lancamentoestoque": // "Receber notificações de lançamentos de estoque"
      result = await handleProduto(supabase, dados);
      break;

    case "contato":
      result = await handleContato(supabase, dados);
      break;

    default:
      console.warn(`[Webhook Tiny] Tipo não tratado: "${tipo}"`);
      // Retornar 200 mesmo assim para o Tiny não reprocessar
      return NextResponse.json({
        received: true,
        message: `Evento "${tipo}" recebido mas não mapeado.`,
      });
  }

  console.info(`[Webhook Tiny] Resultado:`, result.message);

  // Sempre 200 — Tiny reprocessa em caso de erro HTTP
  return NextResponse.json({
    received: true,
    ok: result.ok,
    message: result.message,
  });
}

/** GET — verificação de health pelo Tiny antes de ativar o webhook */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const hasSecret = !!process.env.TINY_WEBHOOK_SECRET;
  const webhookUrl = hasSecret
    ? `${appUrl}/api/webhooks/tiny?token=***`
    : `${appUrl}/api/webhooks/tiny`;

  return NextResponse.json({
    status: "active",
    message: "ADDS CRM — Webhook Tiny ERP ativo.",
    webhook_url: webhookUrl,
    token_protected: hasSecret,
  });
}
