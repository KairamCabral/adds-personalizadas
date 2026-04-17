/**
 * Processamento unificado de notificações Tiny (pedido, NF, produto, contato).
 * Usado por `/api/webhooks/tiny` e por `/api/tiny/webhook/[secret]`.
 */

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  importTinyOrderFromApi,
  mapTinySituacaoToCrmStatus,
} from "@/lib/tiny/tiny-order-import";

export interface TinyPayload {
  tipo: string;
  dados: Record<string, unknown>;
}

export interface ParseResult {
  payload: TinyPayload | null;
  rawBody: string;
  contentType: string;
}

export function parseTinyPayloadFromRawBody(
  rawBody: string,
  contentType: string
): ParseResult {
  try {
    if (contentType.includes("application/json")) {
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      const dados =
        typeof body.dados === "string"
          ? (JSON.parse(body.dados) as Record<string, unknown>)
          : ((body.dados ?? body) as Record<string, unknown>);
      return {
        payload: { tipo: (body.tipo as string) ?? "", dados },
        rawBody,
        contentType,
      };
    }

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

  let { data: order } = await supabase
    .from("orders")
    .select("id, status, tiny_invoice_id")
    .eq("tiny_order_id", tinyOrderId)
    .maybeSingle();

  if (!order) {
    const imported = await importTinyOrderFromApi(supabase, tinyOrderId);
    await logSync(supabase, {
      entity_type: "order",
      entity_id: imported.orderId ?? null,
      tiny_id: tinyOrderId,
      direction: "pull",
      status: imported.ok ? "success" : "error",
      error_message: imported.ok ? null : imported.message,
    });

    if (!imported.ok) {
      return {
        ok: false,
        message: imported.message,
      };
    }

    const refetch = await supabase
      .from("orders")
      .select("id, status, tiny_invoice_id")
      .eq("tiny_order_id", tinyOrderId)
      .maybeSingle();

    order = refetch.data;
    if (!order) {
      return {
        ok: false,
        message: "Pedido importado mas não encontrado após refetch.",
      };
    }
  }

  const updates: Database["public"]["Tables"]["orders"]["Update"] = {};

  const situacaoRaw = dados.situacao;
  if (situacaoRaw !== undefined && situacaoRaw !== null && situacaoRaw !== "") {
    const mappedStatus = mapTinySituacaoToCrmStatus(situacaoRaw);
    if (mappedStatus !== order.status) {
      updates.status = mappedStatus;
    }
  }

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

    default:
      console.warn(`[Webhook Tiny] Tipo não tratado: "${tipo}"`);
      return {
        ok: true,
        message: `Evento "${tipo}" recebido mas não mapeado.`,
      };
  }
}
