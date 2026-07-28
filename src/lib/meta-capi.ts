import { createHash } from "crypto";

import type { Database } from "@/types/database.types";

/** Versão da Graph API usada para a Conversions API. */
export const META_GRAPH_API_VERSION = "v21.0";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type PublicQuoteRow = Database["public"]["Tables"]["public_quotes"]["Row"];

/**
 * Normaliza e aplica SHA-256 — formato exigido pela Meta para os campos de
 * user_data (advanced matching). Retorna null quando não há valor utilizável.
 */
export function hashUserField(
  raw: string | null | undefined,
  kind: "email" | "phone" | "name",
): string | null {
  if (!raw) return null;
  let v = raw.trim().toLowerCase();
  if (!v) return null;

  if (kind === "phone") {
    let digits = v.replace(/\D/g, "");
    if (!digits) return null;
    // Garante o DDI do Brasil (55) para números locais (10-11 dígitos).
    if (digits.length <= 11 && !digits.startsWith("55")) digits = `55${digits}`;
    v = digits;
  } else if (kind === "name") {
    v = v.normalize("NFD").replace(/\p{M}/gu, ""); // remove acentos
  }

  return createHash("sha256").update(v).digest("hex");
}

export type OrderItemForValue = Pick<
  OrderItemRow,
  "total_price" | "unit_price" | "quantity"
>;

/** Valor do pedido = soma dos totais de linha (fallback: unit_price * quantity). */
export function calcOrderValue(items: OrderItemForValue[]): number {
  const total = items.reduce((sum, it) => {
    const line =
      it.total_price ??
      (it.unit_price != null ? it.unit_price * (it.quantity ?? 1) : 0);
    return sum + (line ?? 0);
  }, 0);
  return Math.round(total * 100) / 100;
}

export interface PurchaseInput {
  order: Pick<OrderRow, "order_number" | "contact_phone" | "contact_name">;
  client: Pick<ClientRow, "email" | "phone" | "name"> | null;
  items: OrderItemForValue[];
}

interface MetaCapiEventBase {
  event_id: string;
  user_data: Record<string, string[]>;
}

export interface PurchaseEvent extends MetaCapiEventBase {
  event_name: "Purchase";
  /** A NF é emitida pelo negócio, não pelo cliente — daí `system_generated`. */
  action_source: "system_generated";
  custom_data: { currency: "BRL"; value: number; order_id: string };
}

export interface LeadEvent extends MetaCapiEventBase {
  event_name: "Lead";
  /** O orçamento FOI preenchido pelo cliente num formulário web. */
  action_source: "website";
  custom_data: {
    currency: "BRL";
    value?: number;
    content_name: string;
    quote_id: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
}

export type MetaCapiEvent = PurchaseEvent | LeadEvent;

/**
 * Monta o evento Purchase da CAPI a partir de um pedido faturado. Função pura
 * (sem I/O e sem tempo) — o `event_time` é injetado no envio.
 *
 * `event_id = order_<order_number>` dá idempotência/dedupe no lado do Meta:
 * reenviar o mesmo pedido não conta a conversão duas vezes.
 */
export function buildPurchaseEvent(input: PurchaseInput): PurchaseEvent {
  const { order, client, items } = input;

  const user_data: Record<string, string[]> = {};
  const email = hashUserField(client?.email, "email");
  const phone = hashUserField(client?.phone ?? order.contact_phone, "phone");
  if (email) user_data.em = [email];
  if (phone) user_data.ph = [phone];

  const fullName = (client?.name ?? order.contact_name ?? "").trim();
  if (fullName) {
    const [first, ...rest] = fullName.split(/\s+/);
    const fn = hashUserField(first, "name");
    const ln = hashUserField(rest.join(" "), "name");
    if (fn) user_data.fn = [fn];
    if (ln) user_data.ln = [ln];
  }

  return {
    event_name: "Purchase",
    event_id: `order_${order.order_number}`,
    action_source: "system_generated",
    user_data,
    custom_data: {
      currency: "BRL",
      value: calcOrderValue(items),
      order_id: String(order.order_number),
    },
  };
}

export interface LeadInput {
  quote: Pick<
    PublicQuoteRow,
    | "id"
    | "client_name"
    | "client_email"
    | "client_phone"
    | "client_whatsapp"
    | "estimated_value"
    | "utm_source"
    | "utm_medium"
    | "utm_campaign"
  >;
}

/**
 * Monta o evento Lead a partir de um orçamento público.
 *
 * Por que ESTE é o Lead que vale: o formulário traz nome, e-mail e telefone
 * reais, então a correspondência no Meta é alta — muito acima do clique no
 * botão de WhatsApp do quiz, que não carrega dado nenhum do usuário.
 *
 * O `value` é o `estimated_value` recalculado no servidor pelo pricing (ver
 * api/quote/submit), então varia de verdade a cada orçamento. Isso importa: o
 * Gerenciador de Eventos acusa "todos os eventos Lead enviando os mesmos dados
 * de preço" justamente porque valor fixo não serve para calcular ROAS.
 *
 * `event_id = quote_<uuid>` dá idempotência: reprocessar não duplica conversão.
 */
export function buildLeadEvent(input: LeadInput): LeadEvent {
  const { quote } = input;

  const user_data: Record<string, string[]> = {};
  const email = hashUserField(quote.client_email, "email");
  // WhatsApp primeiro: é o canal que o dentista realmente usa, e costuma vir
  // preenchido com mais frequência que o telefone fixo.
  const phone = hashUserField(quote.client_whatsapp ?? quote.client_phone, "phone");
  if (email) user_data.em = [email];
  if (phone) user_data.ph = [phone];

  const fullName = (quote.client_name ?? "").trim();
  if (fullName) {
    const [first, ...rest] = fullName.split(/\s+/);
    const fn = hashUserField(first, "name");
    const ln = hashUserField(rest.join(" "), "name");
    if (fn) user_data.fn = [fn];
    if (ln) user_data.ln = [ln];
  }

  const custom_data: LeadEvent["custom_data"] = {
    currency: "BRL",
    content_name: "orcamento_publico",
    quote_id: quote.id,
  };

  // Só manda value quando há número utilizável. Zero ou null seria pior que
  // omitir: o Meta passaria a calcular ROAS em cima de um valor falso.
  if (quote.estimated_value != null && quote.estimated_value > 0) {
    custom_data.value = Math.round(quote.estimated_value * 100) / 100;
  }

  if (quote.utm_source) custom_data.utm_source = quote.utm_source;
  if (quote.utm_medium) custom_data.utm_medium = quote.utm_medium;
  if (quote.utm_campaign) custom_data.utm_campaign = quote.utm_campaign;

  return {
    event_name: "Lead",
    event_id: `quote_${quote.id}`,
    action_source: "website",
    user_data,
    custom_data,
  };
}

/** true quando o evento tem ao menos uma chave de match (email ou telefone). */
export function hasMatchKey(event: MetaCapiEvent): boolean {
  return Boolean(event.user_data.em || event.user_data.ph);
}

export interface SendOptions {
  pixelId: string;
  accessToken: string;
  /** Quando false, roda em DRY-RUN: nada é enviado ao Meta. */
  enabled: boolean;
  /** Código do "Testar eventos" do Meta (valida sem afetar dados de produção). */
  testEventCode?: string;
  /** Unix time do evento; default = agora. */
  eventTimeUnix?: number;
  /** Injeção para testes. */
  fetchImpl?: typeof fetch;
}

export interface SendResult {
  ok: boolean;
  mode: "live" | "dry-run";
  status?: number;
  body?: unknown;
}

/**
 * Envia um evento (Purchase ou Lead) à Meta CAPI. Se `enabled` for false, roda
 * em DRY-RUN: não faz nenhuma chamada externa, apenas devolve o payload que
 * seria enviado — a rede de segurança para não poluir o Meta antes de validarmos.
 */
export async function sendEventToMeta(
  event: MetaCapiEvent,
  opts: SendOptions,
): Promise<SendResult> {
  const event_time = opts.eventTimeUnix ?? Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = { data: [{ ...event, event_time }] };
  if (opts.testEventCode) payload.test_event_code = opts.testEventCode;

  if (!opts.enabled) {
    return { ok: true, mode: "dry-run", body: payload };
  }

  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${opts.pixelId}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Token no header, nunca na query string: URL entra em log de servidor,
        // proxy e APM, e este token dá acesso de escrita ao dataset do pixel.
        Authorization: `Bearer ${opts.accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );
  const body = await res.json().catch(() => null);
  return { ok: res.ok, mode: "live", status: res.status, body };
}
