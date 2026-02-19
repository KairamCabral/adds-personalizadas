import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tinyApiGet } from "@/lib/tiny-api";

const LOG_PREFIX = "[Tiny Sync]";

function cleanClientName(rawName: string): string {
  if (!rawName || typeof rawName !== "string") return rawName || "";
  return (
    rawName
      .replace(
        /^\d{2,3}\.?\d{3}\.?\d{3}\/?\d{0,4}-?\d{0,2}\s*/,
        ""
      )
      .replace(/^\d{5,14}\s+/, "")
      .trim() || rawName
  );
}

/** Nome parece empresa (LTDA, S.A., etc)? */
function looksLikeCompany(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const upper = name.toUpperCase();
  return (
    /\b(LTDA|S\.?A\.?|S\/A|EIRELI|ME\b|EPP\b|E\.?P\.?)\b/.test(upper) ||
    upper.includes("CLINICA") ||
    upper.includes("ODONTOLOG")
  );
}

function detectPersonType(contact: any): "FISICA" | "JURIDICA" {
  if (["F", "E", "X"].includes(contact.tipoPessoa)) return "FISICA";
  if (contact.tipoPessoa === "J") {
    const doc = (contact.cpfCnpj || contact.cpf_cnpj || "")
      .replace(/\D/g, "");
    const name = contact.nome ?? contact.nomeFantasia ?? contact.fantasia ?? "";
    // Se documento vazio e nome não parece empresa, provável cadastro incorreto no Tiny
    if (doc.length === 0 && !looksLikeCompany(name)) return "FISICA";
    return "JURIDICA";
  }
  const doc = (contact.cpfCnpj || contact.cpf_cnpj || "")
    .replace(/\D/g, "");
  if (doc.length === 11) return "FISICA";
  if (doc.length === 14) return "JURIDICA";
  return "FISICA";
}

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
        const raw = contact.contato ?? contact;
        const rawName = raw.nome ?? raw.nomeFantasia ?? raw.fantasia ?? "Sem nome";
        const endereco = raw.endereco ?? {};
        const city =
          endereco.municipio ??
          endereco.cidade ??
          raw.municipio ??
          raw.cidade ??
          null;
        const clientData = {
          name: cleanClientName(rawName),
          email: raw.email ?? null,
          phone:
            raw.telefone ??
            raw.fone ??
            raw.celular ??
            raw.telefoneComercial ??
            null,
          company: raw.nomeFantasia ?? raw.fantasia ?? null,
          document: raw.cpfCnpj ?? raw.cpf_cnpj ?? null,
          person_type: detectPersonType(raw),
          city,
          state: endereco.uf ?? raw.uf ?? null,
          zip_code: endereco.cep ?? raw.cep ?? null,
          street: endereco.endereco ?? raw.endereco ?? null,
          number: endereco.numero ?? raw.numero ?? null,
          complement: endereco.complemento ?? raw.complemento ?? null,
          neighborhood: endereco.bairro ?? raw.bairro ?? null,
          tiny_id: raw.id,
          tiny_synced_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("clients")
          .upsert(clientData as any, { onConflict: "tiny_id" });

        if (!error) synced++;

        await supabase.from("tiny_sync_logs").insert({
          entity_type: "client",
          tiny_id: raw.id,
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

/** Mapeia situacao Tiny (número) para status do CRM */
function mapTinySituacaoToStatus(situacao: number | string): string {
  const s = typeof situacao === "string" ? parseInt(situacao, 10) : situacao;
  switch (s) {
    case 8: // Dados Incompletos
    case 0: // Aberta
      return "FAZER";
    case 3: // Aprovada
      return "APROVADO";
    case 4: // Preparando Envio
      return "PRODUCAO";
    case 1: // Faturada
      return "FATURADO";
    case 7: // Pronto Envio
    case 5: // Enviada
    case 9: // Não Entregue
      return "EXPEDICAO";
    case 6: // Entregue
      return "ENTREGUE";
    case 2: // Cancelada
      return "ARQUIVADO";
    default:
      return "FAZER";
  }
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
        const tinyOrderId = raw.id;
        const clienteId = raw.cliente?.id ?? raw.idCliente;
        const clienteNome = raw.cliente?.nome ?? raw.nomeCliente ?? "Cliente";
        const numeroPedido = raw.numeroPedido ?? raw.numero ?? tinyOrderId;
        const valor = raw.valor ?? raw.total ?? raw.valorTotal;
        const dataPrevista = raw.dataPrevista ?? raw.data_prevista;
        const situacao = raw.situacao ?? raw.status ?? 0;

        if (!tinyOrderId) {
          console.warn(`${LOG_PREFIX} Pedido sem id, pulando`);
          skipped++;
          continue;
        }

        const { data: clientRow } = await supabase
          .from("clients")
          .select("id")
          .eq("tiny_id", clienteId)
          .single();

        if (!clientRow?.id) {
          console.log(
            `${LOG_PREFIX} Cliente tiny_id=${clienteId} não encontrado no CRM, pulando pedido ${tinyOrderId}`
          );
          skipped++;
          continue;
        }

        const orderData = {
          title: `Pedido #${numeroPedido} - ${clienteNome}`,
          description: valor != null ? `Valor: R$ ${valor}` : null,
          client_id: clientRow.id,
          status: mapTinySituacaoToStatus(situacao),
          due_date: dataPrevista ? parseTinyDate(dataPrevista) : null,
          tiny_order_id: tinyOrderId,
          order_type: "PERSONALIZADO" as const,
          priority: "NORMAL" as const,
          position: 0,
        };

        const { data: upsertedOrder, error } = await supabase
          .from("orders")
          .upsert(orderData as any, {
            onConflict: "tiny_order_id",
            ignoreDuplicates: false,
          })
          .select("id")
          .single();

        if (!error) synced++;

        await supabase.from("tiny_sync_logs").insert({
          entity_type: "order",
          tiny_id: tinyOrderId,
          direction: "tiny_to_crm",
          status: error ? "error" : "success",
          error_message: error?.message ?? null,
        });

        if (error || !upsertedOrder?.id) continue;

        const orderId = upsertedOrder.id;

        const tinyItens =
          raw.itens ??
          raw.itensPedido ??
          raw.itens_pedido ??
          raw.produtos ??
          [];

        const itemsToInsert: {
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number | null;
          total_price: number | null;
        }[] = [];

        if (Array.isArray(tinyItens) && tinyItens.length > 0) {
          for (const ti of tinyItens) {
            const item = ti.item ?? ti.produto ?? ti;
            const productName =
              item.nome ??
              item.descricao ??
              item.produto?.nome ??
              item.produto?.descricao ??
              "Item";
            const qty = Number(item.quantidade ?? item.qtd ?? 1) || 1;
            const unitPrice =
              item.valorUnitario ??
              item.valor_unitario ??
              item.preco ??
              item.produto?.preco;
            const totalPrice =
              item.valorTotal ??
              item.valor_total ??
              item.valor ??
              (unitPrice != null ? Number(unitPrice) * qty : null);

            let productId: string | null = null;
            const tinyProductId = item.produto?.id ?? item.produto_id ?? item.idProduto;
            if (tinyProductId) {
              const { data: prod } = await supabase
                .from("products")
                .select("id")
                .eq("tiny_id", tinyProductId)
                .maybeSingle();
              productId = prod?.id ?? null;
            }

            itemsToInsert.push({
              order_id: orderId,
              product_id: productId,
              product_name: String(productName),
              quantity: qty,
              unit_price: unitPrice != null ? Number(unitPrice) : null,
              total_price: totalPrice != null ? Number(totalPrice) : null,
            });
          }
        }

        if (itemsToInsert.length === 0 && valor != null) {
          const totalVal = Number(valor);
          if (!isNaN(totalVal) && totalVal > 0) {
            itemsToInsert.push({
              order_id: orderId,
              product_id: null,
              product_name: "Pedido",
              quantity: 1,
              unit_price: totalVal,
              total_price: totalVal,
            });
          }
        }

        if (itemsToInsert.length > 0) {
          await supabase.from("order_items").delete().eq("order_id", orderId);
          await supabase.from("order_items").insert(itemsToInsert);
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
    `${LOG_PREFIX} Sync pedidos concluído: ${synced} sincronizados, ${skipped} pulados`
  );
  return NextResponse.json({
    success: true,
    message: `${synced} pedidos sincronizados com sucesso.${skipped > 0 ? ` ${skipped} pulados (cliente não encontrado).` : ""}`,
    synced,
    skipped,
  });
}

function parseTinyDate(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
