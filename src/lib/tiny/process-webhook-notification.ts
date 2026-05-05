/**
 * Processamento unificado de notificações Tiny (pedido, NF, produto, contato).
 * Usado por `/api/webhooks/tiny` e por `/api/tiny/webhook/[secret]`.
 */

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { importTinyOrderFromApi } from "@/lib/tiny/tiny-order-import";
import { applyPagoCrmFromTiny } from "@/lib/tiny/tiny-faturado-crm";

export interface TinyPayload {
  tipo: string;
  dados: Record<string, unknown>;
}

export interface ParseResult {
  payload: TinyPayload | null;
  rawBody: string;
  contentType: string;
}

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "").trim();
}

/**
 * Interpreta JSON no formato Tiny (`tipo` + `dados` ou objeto único).
 * Usado quando o corpo começa com `{` — cobre o caso comum em que o Tiny
 * envia JSON mas o Content-Type não é `application/json` (ex.: text/plain).
 */
function tryParseJsonTinyPayload(trimmedBody: string): TinyPayload | null {
  try {
    if (!trimmedBody.startsWith("{") && !trimmedBody.startsWith("[")) {
      return null;
    }
    const body = JSON.parse(trimmedBody) as Record<string, unknown>;
    if (Array.isArray(body)) return null;

    const dados =
      typeof body.dados === "string"
        ? (JSON.parse(body.dados) as Record<string, unknown>)
        : ((body.dados ?? body) as Record<string, unknown>);

    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      return null;
    }

    return {
      tipo: String(body.tipo ?? ""),
      dados,
    };
  } catch {
    return null;
  }
}

/** Form Tiny V2: tipo=...&dados=... */
function tryParseFormTinyPayload(rawBody: string): TinyPayload | null {
  try {
    const params = new URLSearchParams(rawBody);
    const tipo = params.get("tipo") ?? "";
    const dadosRaw = params.get("dados") ?? "{}";
    const dados = JSON.parse(dadosRaw) as Record<string, unknown>;
    return { tipo, dados };
  } catch {
    return null;
  }
}

/**
 * Aceita JSON (com ou sem header correto) e form-urlencoded.
 * Ordem: JSON pelo texto (`{`…); depois form; depois JSON se o header disser json.
 */
export function parseTinyPayloadFromRawBody(
  rawBody: string,
  contentType: string
): ParseResult {
  const trimmed = stripBom(rawBody);

  if (!trimmed) {
    return { payload: null, rawBody, contentType };
  }

  try {
    const fromJson = tryParseJsonTinyPayload(trimmed);
    if (fromJson) {
      return { payload: fromJson, rawBody, contentType };
    }

    const fromForm = tryParseFormTinyPayload(rawBody);
    if (fromForm) {
      return { payload: fromForm, rawBody, contentType };
    }

    console.warn(
      "[Webhook Tiny] Payload não reconhecido (nem JSON `{` nem form tipo=&dados=)."
    );
    return { payload: null, rawBody, contentType };
  } catch (err) {
    console.error("[Webhook Tiny] Erro ao parsear payload:", err);
    return { payload: null, rawBody, contentType };
  }
}

export async function parseTinyPayloadFromRequest(
  request: NextRequest
): Promise<ParseResult> {
  const contentType = request.headers.get("content-type") ?? "";
  const rawBody = await request.text();
  return parseTinyPayloadFromRawBody(rawBody, contentType);
}

export async function relayWebhook(rawBody: string, contentType: string) {
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

async function logSync(
  supabase: SupabaseClient<Database>,
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

async function handlePedido(
  supabase: SupabaseClient<Database>,
  dados: Record<string, unknown>
) {
  const tinyOrderId = Number(dados.id ?? dados.idPedido);
  if (!tinyOrderId) return { ok: false, message: "ID do pedido ausente." };

  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("tiny_order_id", tinyOrderId)
    .maybeSingle();

  // PROTEÇÃO: não criar pedido antigo retroativamente via webhook.
  // O Tiny pode enviar atualizacao_pedido para pedidos que nunca
  // chegaram ao CRM (ex.: webhook original perdido). Se o pedido for
  // antigo e não existir no CRM, ignoramos em vez de importá-lo agora.
  if (!existing) {
    const MAX_RETRO_DAYS = 7;
    const orderDateRaw = dados.data as string | undefined;
    if (orderDateRaw) {
      // Tiny envia em DD/MM/YYYY
      const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(orderDateRaw.trim());
      if (match) {
        const [, dd, mm, yyyy] = match;
        const orderDate = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
        if (!isNaN(orderDate.getTime())) {
          const daysSinceOrder =
            (Date.now() - orderDate.getTime()) / 86_400_000;
          if (daysSinceOrder > MAX_RETRO_DAYS) {
            console.info(
              `[Webhook Tiny] Ignorando atualização retroativa: ` +
                `tiny_order_id=${tinyOrderId} data=${orderDateRaw} ` +
                `(${daysSinceOrder.toFixed(0)} dias atrás, > ${MAX_RETRO_DAYS})`
            );
            await logSync(supabase, {
              entity_type: "order",
              entity_id: null,
              tiny_id: tinyOrderId,
              direction: "pull",
              status: "success",
              error_message: `Ignorado: pedido antigo não existente no CRM (${daysSinceOrder.toFixed(0)}d)`,
            });
            return {
              ok: true,
              message: `Pedido antigo (${daysSinceOrder.toFixed(0)} dias) ignorado — não está no CRM e é muito antigo para importar retroativamente.`,
            };
          }
        }
      }
    }
  }

  // Re-sync completo: Tiny é fonte da verdade pro pedido inteiro (cliente,
  // itens, endereço, situação). Hash em `orders.tiny_sync_hash` faz
  // short-circuit quando o snapshot Tiny não mudou desde o último sync.
  // `importTinyOrderFromApi` já preserva camada CRM (description,
  // contact_name/phone, personalization.custom_color/notes) em re-sync.
  const imported = await importTinyOrderFromApi(supabase, tinyOrderId);
  await logSync(supabase, {
    entity_type: "order",
    entity_id: imported.orderId ?? existing?.id ?? null,
    tiny_id: tinyOrderId,
    direction: "pull",
    status: imported.ok ? "success" : "error",
    error_message: imported.ok ? null : imported.message,
  });

  return imported.ok
    ? { ok: true, message: imported.message }
    : { ok: false, message: imported.message };
}

async function handleNotaFiscal(
  supabase: SupabaseClient<Database>,
  dados: Record<string, unknown>
) {
  const tinyNfId = dados.id ? Number(dados.id) : undefined;
  const tinyOrderId = dados.idPedido
    ? Number(dados.idPedido)
    : dados.pedido
      ? Number((dados.pedido as Record<string, unknown>).id)
      : undefined;

  if (!tinyOrderId) {
    console.info("[Webhook Tiny] NF sem pedido vinculado:", tinyNfId);
    return {
      ok: true,
      message: `NF #${tinyNfId} recebida mas sem pedido vinculado.`,
    };
  }

  let { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("tiny_order_id", tinyOrderId)
    .maybeSingle();

  if (!order) {
    const imported = await importTinyOrderFromApi(supabase, tinyOrderId);
    if (!imported.ok) {
      await logSync(supabase, {
        entity_type: "invoice",
        tiny_id: tinyNfId ?? tinyOrderId,
        direction: "pull",
        status: "error",
        error_message: imported.message,
      });
      return {
        ok: false,
        message: `Pedido não encontrado e importação falhou: ${imported.message}`,
      };
    }
    const refetch = await supabase
      .from("orders")
      .select("id, status")
      .eq("tiny_order_id", tinyOrderId)
      .maybeSingle();
    order = refetch.data;
    if (!order) {
      return { ok: false, message: "Pedido não encontrado após importação." };
    }
  }

  await applyPagoCrmFromTiny(supabase, order.id, order.status);

  // Atualizar tiny_invoice_id (mas não alterar status para FATURADO)
  const { error } = await supabase
    .from("orders")
    .update({
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
      ? `Erro ao processar NF do pedido: ${error.message}`
      : `Pedido ${order.id} marcado como PAGO (NF #${tinyNfId}).`,
  };
}

async function handleProduto(
  supabase: SupabaseClient<Database>,
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
      .update(updates as Database["public"]["Tables"]["products"]["Update"])
      .eq("id", product.id);
    error = upErr;
  } else if (dados.nome) {
    const { data: created, error: insErr } = await supabase
      .from("products")
      .insert({
        name: dados.nome as string,
        stock: Number(dados.estoque ?? dados.estoquePosicao) || 0,
        price: dados.preco ? Number(dados.preco) : null,
        tiny_id: tinyProductId,
        tiny_synced_at: new Date().toISOString(),
      } as Database["public"]["Tables"]["products"]["Insert"])
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

async function handleContato(
  supabase: SupabaseClient<Database>,
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
    clientData.person_type = dados.tipoPessoa === "J" ? "JURIDICA" : "FISICA";
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
      .update(clientData as Database["public"]["Tables"]["clients"]["Update"])
      .eq("id", client.id);
    error = upErr;
  } else if (dados.nome) {
    const { data: created, error: insErr } = await supabase
      .from("clients")
      .insert({
        ...clientData,
        name: dados.nome as string,
        tiny_id: tinyContactId,
      } as Database["public"]["Tables"]["clients"]["Insert"])
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

export async function processTinyWebhookNotification(
  supabase: SupabaseClient<Database>,
  payload: TinyPayload
): Promise<{ ok: boolean; message: string }> {
  const tipo = payload.tipo.toLowerCase().replace(/\s/g, "");
  const dados = payload.dados;

  console.info(`[Webhook Tiny] tipo="${tipo}" | relay=${!!process.env.TINY_RELAY_URL}`);

  switch (tipo) {
    case "pedido":
    case "pedidoenviado":
    case "inclusao_pedido":
    case "atualizacao_pedido":
      return handlePedido(supabase, dados);

    case "notafiscal":
    case "nota_fiscal":
    case "nfe":
      return handleNotaFiscal(supabase, dados);

    case "produto":
    case "estoque":
    case "lancamentoestoque":
      return handleProduto(supabase, dados);

    case "contato":
      return handleContato(supabase, dados);

    case "rastreio":
      // Evento de rastreio recebido — por enquanto só logar.
      // O rastreio já vem junto com atualizacao_pedido em alguns casos.
      console.info(
        `[Webhook Tiny] Rastreio recebido para tiny_order_id=${dados.id ?? dados.idPedido ?? "desconhecido"}`
      );
      return {
        ok: true,
        message: "Rastreio recebido (não processado nesta versão).",
      };

    default:
      console.warn(`[Webhook Tiny] Tipo não tratado: "${tipo}"`);
      return {
        ok: true,
        message: `Evento "${tipo}" recebido mas não mapeado.`,
      };
  }
}
