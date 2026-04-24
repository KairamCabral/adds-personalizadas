import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tinyApiGet, TinyTokenExpiredError } from "@/lib/tiny-api";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["MASTER", "GESTOR"].includes(profile.role as string)) {
      return NextResponse.json(
        { error: "Apenas MASTER ou GESTOR podem vincular pedidos ao Tiny." },
        { status: 403 }
      );
    }

    const { id: orderId } = await context.params;
    const body = await request.json();
    const numeroPedido = body.numeroPedido;

    if (!numeroPedido) {
      return NextResponse.json(
        { error: "Número do pedido Tiny é obrigatório." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, tiny_order_id, title")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Pedido não encontrado no CRM." },
        { status: 404 }
      );
    }

    if (order.tiny_order_id) {
      return NextResponse.json(
        { error: `Pedido já vinculado ao Tiny (ID: ${order.tiny_order_id}).` },
        { status: 409 }
      );
    }

    const coerceTinyOrderId = (idVal: unknown): number | null => {
      const n =
        typeof idVal === "number"
          ? idVal
          : typeof idVal === "string"
            ? Number(idVal)
            : NaN;
      return Number.isFinite(n) ? n : null;
    };

    // === BUSCA MULTI-ESTRATÉGIA ===
    let tinyOrderId: number | null = null;
    let tinyOrderInfo: {
      numeroPedido: number;
      cliente?: string | null;
      data?: string | null;
    } | null = null;

    // Estratégia 1: Buscar nos webhooks já capturados (banco local — mais rápido)
    const { data: webhookMatch } = await supabase
      .from("tiny_webhook_events")
      .select("tiny_order_id, payload")
      .filter("payload->dados->>numero", "eq", String(numeroPedido))
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (webhookMatch?.tiny_order_id) {
      const idFromWebhook = coerceTinyOrderId(webhookMatch.tiny_order_id);
      if (idFromWebhook) {
        tinyOrderId = idFromWebhook;
        const dados = (webhookMatch.payload as { dados?: Record<string, unknown> })
          ?.dados;
        const clienteNome = dados?.cliente;
        tinyOrderInfo = {
          numeroPedido: Number(numeroPedido),
          cliente:
            clienteNome &&
            typeof clienteNome === "object" &&
            clienteNome !== null &&
            "nome" in clienteNome
              ? String((clienteNome as { nome?: string }).nome ?? "")
              : null,
          data: typeof dados?.data === "string" ? dados.data : null,
        };
      }
    }

    // Estratégia 2: Buscar nos pedidos já importados no CRM (title contém o número)
    if (!tinyOrderId) {
      const { data: crmMatch } = await supabase
        .from("orders")
        .select("tiny_order_id, title")
        .not("tiny_order_id", "is", null)
        .or(
          `title.ilike.%#${numeroPedido} -%,title.ilike.%#${numeroPedido}`
        )
        .limit(1)
        .maybeSingle();

      if (crmMatch?.tiny_order_id) {
        const idFromCrm = coerceTinyOrderId(crmMatch.tiny_order_id);
        if (idFromCrm) {
          tinyOrderId = idFromCrm;
          tinyOrderInfo = {
            numeroPedido: Number(numeroPedido),
            cliente: crmMatch.title?.replace(/^Pedido #\d+ - /, "") ?? null,
            data: null,
          };
        }
      }
    }

    // Estratégia 3: Buscar na API do Tiny com parâmetro "pesquisa" (fallback)
    if (!tinyOrderId) {
      try {
        const tinyResponse = await tinyApiGet(
          `/pedidos?numero=${encodeURIComponent(String(numeroPedido))}&limit=10`
        );

        const itens =
          (tinyResponse as { itens?: unknown })?.itens ??
          (tinyResponse as { data?: { itens?: unknown } })?.data?.itens ??
          (tinyResponse as { data?: unknown[] })?.data ??
          [];

        const results = Array.isArray(itens) ? itens : [];

        for (const item of results) {
          const raw = (
            item && typeof item === "object" && "pedido" in item
              ? (item as { pedido: Record<string, unknown> }).pedido
              : item
          ) as Record<string, unknown>;
          const num = raw.numeroPedido ?? raw.numero ?? raw.numero_pedido;
          if (String(num) === String(numeroPedido)) {
            const idParsed = coerceTinyOrderId(raw.id);
            if (!idParsed) continue;
            tinyOrderId = idParsed;
            const clienteRaw = raw.cliente;
            const nomeCliente =
              clienteRaw &&
              typeof clienteRaw === "object" &&
              clienteRaw !== null &&
              "nome" in clienteRaw
                ? String((clienteRaw as { nome?: string }).nome ?? "")
                : typeof raw.nomeCliente === "string"
                  ? raw.nomeCliente
                  : null;
            tinyOrderInfo = {
              numeroPedido: Number(num),
              cliente: nomeCliente,
              data: typeof raw.data === "string" ? raw.data : null,
            };
            break;
          }
        }
      } catch (err) {
        if (err instanceof TinyTokenExpiredError) {
          return NextResponse.json(
            { error: err.message, code: "TINY_RECONNECT" },
            { status: 401 }
          );
        }
        console.warn("[link-tiny] Fallback API search failed:", err);
      }
    }

    // Estratégia 4: Buscar direto pelo ID (se o usuário digitou o ID do Tiny em vez do número)
    if (!tinyOrderId && String(numeroPedido).length >= 9) {
      try {
        const directResponse = await tinyApiGet(`/pedidos/${numeroPedido}`);
        const directData =
          (directResponse as { data?: Record<string, unknown> })?.data ??
          (directResponse as Record<string, unknown>);
        if (directData && typeof directData === "object" && "id" in directData) {
          const idParsed = coerceTinyOrderId(
            (directData as { id?: unknown }).id
          );
          if (idParsed) {
            tinyOrderId = idParsed;
            const clienteRaw = (directData as { cliente?: unknown }).cliente;
            const nomeCliente =
              clienteRaw &&
              typeof clienteRaw === "object" &&
              clienteRaw !== null &&
              "nome" in clienteRaw
                ? String((clienteRaw as { nome?: string }).nome ?? "")
                : null;
            const numPed = (directData as { numeroPedido?: unknown })
              .numeroPedido;
            tinyOrderInfo = {
              numeroPedido:
                typeof numPed === "number"
                  ? numPed
                  : typeof numPed === "string"
                    ? Number(numPed)
                    : Number(numeroPedido),
              cliente: nomeCliente,
              data:
                typeof (directData as { data?: unknown }).data === "string"
                  ? ((directData as { data: string }).data)
                  : null,
            };
          }
        }
      } catch (err) {
        if (err instanceof TinyTokenExpiredError) {
          return NextResponse.json(
            { error: err.message, code: "TINY_RECONNECT" },
            { status: 401 }
          );
        }
        // Não é um ID válido — ok, segue
      }
    }

    if (!tinyOrderId) {
      return NextResponse.json(
        {
          error: `Pedido #${numeroPedido} não encontrado no Tiny.`,
          hint: "Verifique o número do pedido e tente novamente.",
        },
        { status: 404 }
      );
    }

    const { data: existing } = await supabase
      .from("orders")
      .select(
        "id, title, archived_at, is_pipeline_managed, client:clients ( name, company )"
      )
      .eq("tiny_order_id", tinyOrderId)
      .neq("id", orderId)
      .maybeSingle();

    if (existing) {
      const c = existing.client as
        | { name?: string | null; company?: string | null }
        | null
        | undefined;
      const cliente = [c?.name, c?.company].filter(Boolean).join(" · ");
      const dicaOnde = existing.archived_at
        ? "Ele pode estar arquivado: abra a visão Arquivados e busque. Pedidos arquivados com Tiny voltam a aparecer em Arquivados."
        : existing.is_pipeline_managed === false
          ? "Esse registro não aparece no Kanban (pedido fora do pipeline do quadro). Abra o card pelo id no Supabase/URL ou ajuste is_pipeline_managed."
          : "Confira a busca do pipeline (sem filtro) pelo título do pedido ou pelo número.";
      const sufixoCliente = cliente
        ? ` Cliente: ${cliente}.`
        : " (sem nome de cliente vinculado).";
      return NextResponse.json(
        {
          error: `Esse nº do Tiny (id interno no CRM: ${tinyOrderId}) já está vinculado a outro registro: "${existing.title}".${sufixoCliente} ${dicaOnde} Conflito — id CRM: ${existing.id} (abrir em /pipeline?order=… use este UUID se o sistema permitir, ou desvincule o Tiny nesse outro card).`,
          conflictOrderId: existing.id,
          conflictTinyIdResolved: tinyOrderId,
          conflictIsPipelineManaged: existing.is_pipeline_managed,
        },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        tiny_order_id: tinyOrderId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tinyOrderId,
      tinyOrderInfo,
      message: `Pedido vinculado ao Tiny #${numeroPedido} com sucesso.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    console.error("[link-tiny]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
