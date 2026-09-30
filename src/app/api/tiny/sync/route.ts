import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tinyApiGet, TinyTokenExpiredError } from "@/lib/tiny-api";
import { clientUpsertPayloadFromTinyContact } from "@/lib/tiny/contact-mapper";
import { importTinyOrderFromApi } from "@/lib/tiny/tiny-order-import";

const LOG_PREFIX = "[Tiny Sync]";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    console.log(`${LOG_PREFIX} POST recebido`);
    const body = await request.json();
    const { entity } = body;
    console.log(`${LOG_PREFIX} entity=${entity}`);

    if (!entity) {
      console.warn(`${LOG_PREFIX} entity ausente no body`);
      return NextResponse.json(
        { error: "Campo 'entity' é obrigatório. Use 'clients', 'products' ou 'orders'." },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    console.log(`${LOG_PREFIX} Supabase client criado`);

    if (entity === "clients") {
      return await syncClients(supabase);
    } else if (entity === "products") {
      return await syncProducts(supabase);
    } else if (entity === "orders") {
      return await syncOrders(supabase);
    }

    console.warn(`${LOG_PREFIX} entity inválida: ${entity}`);
    return NextResponse.json(
      { error: "Entidade inválida. Use 'clients', 'products' ou 'orders'." },
      { status: 400 }
    );
  } catch (error: unknown) {
    if (error instanceof TinyTokenExpiredError) {
      return NextResponse.json(
        { error: error.message, code: "TINY_RECONNECT" },
        { status: 401 }
      );
    }
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`${LOG_PREFIX} Erro geral:`, err.message);
    console.error(`${LOG_PREFIX} Stack:`, err.stack);
    return NextResponse.json(
      { error: err.message || "Erro ao sincronizar" },
      { status: 500 }
    );
  }
}

async function syncClients(supabase: ReturnType<typeof getServiceClient>) {
  let offset = 0;
  const limit = 100;
  let synced = 0;
  let hasMore = true;

  console.log(`${LOG_PREFIX} Iniciando sync de clientes (limit=${limit})`);

  while (hasMore) {
    try {
      const endpoint = `/contatos?limit=${limit}&offset=${offset}`;
      console.log(`${LOG_PREFIX} Chamando Tiny API: ${endpoint}`);

      const response = await tinyApiGet(endpoint);
      console.log(
        `${LOG_PREFIX} Resposta Tiny (contatos) - keys:`,
        Object.keys(response || {})
      );
      console.log(
        `${LOG_PREFIX} Resposta completa (amostra):`,
        JSON.stringify(response, null, 2).slice(0, 2000)
      );

      const contacts =
        (response as any)?.itens ??
        (response as any)?.data?.itens ??
        (response as any)?.contatos ??
        [];

      if (!Array.isArray(contacts)) {
        console.error(
          `${LOG_PREFIX} Resposta não contém array de contatos:`,
          typeof contacts,
          contacts
        );
        throw new Error(
          `Formato inesperado da API Tiny. Resposta: ${JSON.stringify(response).slice(0, 500)}`
        );
      }

      console.log(`${LOG_PREFIX} Página: ${contacts.length} contatos`);

      if (contacts.length === 0) {
        hasMore = false;
        break;
      }

      for (const contact of contacts) {
        const raw = (contact.contato ?? contact) as Record<string, unknown>;
        const clientData = clientUpsertPayloadFromTinyContact(raw);
        if (!clientData) {
          console.warn(`${LOG_PREFIX} Contato sem id Tiny, pulando`);
          continue;
        }

        const { error } = await supabase
          .from("clients")
          .upsert(clientData as any, { onConflict: "tiny_id" });

        if (!error) synced++;

        await supabase.from("tiny_sync_logs").insert({
          entity_type: "client",
          tiny_id: clientData.tiny_id,
          direction: "tiny_to_crm",
          status: error ? "error" : "success",
          error_message: error?.message ?? null,
        });
      }

      offset += contacts.length;
      if (contacts.length < limit) hasMore = false;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error(`${LOG_PREFIX} Erro ao buscar contatos:`, e.message);
      console.error(`${LOG_PREFIX} Stack:`, e.stack);
      throw e;
    }
  }

  console.log(`${LOG_PREFIX} Sync clientes concluído: ${synced} sincronizados`);
  return NextResponse.json({
    success: true,
    message: `${synced} clientes sincronizados com sucesso.`,
    synced,
  });
}

async function syncProducts(supabase: ReturnType<typeof getServiceClient>) {
  let offset = 0;
  const limit = 100;
  let synced = 0;
  let hasMore = true;

  console.log(`${LOG_PREFIX} Iniciando sync de produtos (limit=${limit})`);

  while (hasMore) {
    try {
      const endpoint = `/produtos?limit=${limit}&offset=${offset}`;
      console.log(`${LOG_PREFIX} Chamando Tiny API: ${endpoint}`);

      const response = await tinyApiGet(endpoint);
      console.log(
        `${LOG_PREFIX} Resposta Tiny (produtos) - keys:`,
        Object.keys(response || {})
      );
      console.log(
        `${LOG_PREFIX} Resposta completa (amostra):`,
        JSON.stringify(response, null, 2).slice(0, 2000)
      );

      const products =
        (response as any)?.itens ??
        (response as any)?.data?.itens ??
        (response as any)?.produtos ??
        [];

      if (!Array.isArray(products)) {
        console.error(
          `${LOG_PREFIX} Resposta não contém array de produtos:`,
          typeof products,
          products
        );
        throw new Error(
          `Formato inesperado da API Tiny. Resposta: ${JSON.stringify(response).slice(0, 500)}`
        );
      }

      console.log(`${LOG_PREFIX} Página: ${products.length} produtos`);

      if (products.length === 0) {
        hasMore = false;
        break;
      }

      for (const product of products) {
        const raw = product.produto ?? product;
        const productData = {
          name: raw.nome ?? raw.descricao ?? "Sem nome",
          description: raw.descricaoComplementar ?? raw.descricao ?? null,
          price: raw.preco ? Number(raw.preco) : null,
          category: raw.categoria ?? null,
          stock: raw.estoque ? Number(raw.estoque) : 0,
          tiny_id: raw.id,
          tiny_code: raw.codigo ?? null,
          tiny_synced_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("products")
          .upsert(productData as any, { onConflict: "tiny_id" });

        if (!error) synced++;

        await supabase.from("tiny_sync_logs").insert({
          entity_type: "product",
          tiny_id: raw.id,
          direction: "tiny_to_crm",
          status: error ? "error" : "success",
          error_message: error?.message ?? null,
        });
      }

      offset += products.length;
      if (products.length < limit) hasMore = false;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error(`${LOG_PREFIX} Erro ao buscar produtos:`, e.message);
      console.error(`${LOG_PREFIX} Stack:`, e.stack);
      throw e;
    }
  }

  console.log(`${LOG_PREFIX} Sync produtos concluído: ${synced} sincronizados`);
  return NextResponse.json({
    success: true,
    message: `${synced} produtos sincronizados com sucesso.`,
    synced,
  });
}

async function syncOrders(supabase: ReturnType<typeof getServiceClient>) {
  let offset = 0;
  const limit = 100;
  let synced = 0;
  let skipped = 0;
  let hasMore = true;

  console.log(`${LOG_PREFIX} Iniciando sync de pedidos (limit=${limit})`);

  while (hasMore) {
    try {
      const endpoint = `/pedidos?limit=${limit}&offset=${offset}`;
      console.log(`${LOG_PREFIX} Chamando Tiny API: ${endpoint}`);

      const response = await tinyApiGet(endpoint);
      const orders =
        (response as any)?.itens ??
        (response as any)?.data?.itens ??
        (response as any)?.pedidos ??
        [];

      if (!Array.isArray(orders)) {
        console.error(
          `${LOG_PREFIX} Resposta não contém array de pedidos:`,
          typeof orders,
          orders
        );
        throw new Error(
          `Formato inesperado da API Tiny. Resposta: ${JSON.stringify(response).slice(0, 500)}`
        );
      }

      console.log(`${LOG_PREFIX} Página: ${orders.length} pedidos`);

      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of orders) {
        const raw = item.pedido ?? item;
        const tinyOrderId = Number(raw.id);

        if (!Number.isFinite(tinyOrderId) || tinyOrderId <= 0) {
          console.warn(`${LOG_PREFIX} Pedido sem id, pulando`);
          skipped++;
          continue;
        }

        // Pedido já no CRM: NÃO re-sincroniza pela lista. Status, posição e
        // etapas do Kanban são geridos pelo webhook (importTinyOrderFromApi em
        // atualizacao_pedido). Re-gravar aqui regrediria a etapa (ex.: um
        // pedido em FATURADO voltaria para FAZER se o Tiny ainda o vê "Em aberto").
        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("tiny_order_id", tinyOrderId)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // Importa pelo caminho CANÔNICO (mesmo do webhook): busca o pedido
        // completo em /pedidos/{id}, aplica o filtro de personalizadas
        // (isPersonalizadasOrder) e cria cliente + pedido + itens/cores. Pedido
        // que não é personalizada é ignorado de propósito — é isso que impede
        // vendas comuns (ex.: ESC-ADDS-ULTRA) de poluírem o pipeline. A lista
        // /pedidos não traz sinais suficientes (itens/pagamento/depósito) para
        // classificar, por isso o fetch por id é necessário.
        const imported = await importTinyOrderFromApi(supabase, tinyOrderId);

        await supabase.from("tiny_sync_logs").insert({
          entity_type: "order",
          tiny_id: tinyOrderId,
          direction: "tiny_to_crm",
          status: imported.ok ? "success" : "error",
          error_message: imported.ok ? null : imported.message,
        });

        if (imported.orderId) {
          // Importado de fato (personalizada).
          synced++;
        } else {
          // ok:true sem orderId = não-personalizada (ignorado); ok:false = erro.
          skipped++;
        }
      }

      offset += orders.length;
      if (orders.length < limit) hasMore = false;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error(`${LOG_PREFIX} Erro ao buscar pedidos:`, e.message);
      console.error(`${LOG_PREFIX} Stack:`, e.stack);
      throw e;
    }
  }

  console.log(
    `${LOG_PREFIX} Sync pedidos concluído: ${synced} importados, ${skipped} pulados (já existentes ou não-personalizadas)`
  );
  return NextResponse.json({
    success: true,
    message: `${synced} pedidos personalizados importados.${skipped > 0 ? ` ${skipped} pulados (já existentes ou não-personalizadas).` : ""}`,
    synced,
    skipped,
  });
}
