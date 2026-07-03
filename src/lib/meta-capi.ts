import { createHash } from "crypto";

import type { Database } from "@/types/database.types";

/** Versão da Graph API usada para a Conversions API. */
export const META_GRAPH_API_VERSION = "v21.0";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

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

export interface MetaCapiEvent {
  event_name: "Purchase";
  event_id: string;
  action_source: "system_generated";
  user_data: Record<string, string[]>;
  custom_data: { currency: "BRL"; value: number; order_id: string };
}

/**
 * Monta o evento Purchase da CAPI a partir de um pedido faturado. Função pura
 * (sem I/O e sem tempo) — o `event_time` é injetado no envio.
 *
 * `event_id = order_<order_number>` dá idempotência/dedupe no lado do Meta:
 * reenviar o mesmo pedido não conta a conversão duas vezes.
 */
export function buildPurchaseEvent(input: PurchaseInput): MetaCapiEvent {
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
 * Envia o Purchase à Meta CAPI. Se `enabled` for false, roda em DRY-RUN: não
 * faz nenhuma chamada externa, apenas devolve o payload que seria enviado —
 * a rede de segurança para não poluir o Meta antes de validarmos.
 */
export async function sendPurchaseToMeta(
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
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${opts.pixelId}/events?access_token=${encodeURIComponent(opts.accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const body = await res.json().catch(() => null);
  return { ok: res.ok, mode: "live", status: res.status, body };
}
