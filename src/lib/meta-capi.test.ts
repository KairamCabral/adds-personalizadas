import { describe, expect, it, vi } from "vitest";

import {
  buildLeadEvent,
  buildPurchaseEvent,
  calcOrderValue,
  hasMatchKey,
  hashUserField,
  sendEventToMeta,
} from "./meta-capi";

describe("hashUserField", () => {
  it("normaliza telefone brasileiro e adiciona DDI 55", () => {
    const a = hashUserField("(48) 3643-0676", "phone");
    const b = hashUserField("554836430676", "phone");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("não duplica o 55 quando já presente", () => {
    expect(hashUserField("5548999999999", "phone")).toBe(
      hashUserField("48999999999", "phone"),
    );
  });

  it("email vira minúsculo e sem espaços nas bordas", () => {
    expect(hashUserField("  Foo@Bar.com ", "email")).toBe(
      hashUserField("foo@bar.com", "email"),
    );
  });

  it("retorna null quando vazio ou nulo", () => {
    expect(hashUserField("", "email")).toBeNull();
    expect(hashUserField(null, "phone")).toBeNull();
    expect(hashUserField("   ", "name")).toBeNull();
  });
});

describe("calcOrderValue", () => {
  it("soma os total_price das linhas", () => {
    expect(
      calcOrderValue([
        { total_price: 100, unit_price: null, quantity: 2 },
        { total_price: 49.9, unit_price: null, quantity: 1 },
      ]),
    ).toBe(149.9);
  });

  it("usa unit_price * quantity quando total_price é null", () => {
    expect(
      calcOrderValue([{ total_price: null, unit_price: 30, quantity: 3 }]),
    ).toBe(90);
  });

  it("vale 0 para pedido sem itens/preços", () => {
    expect(calcOrderValue([])).toBe(0);
  });
});

describe("buildPurchaseEvent", () => {
  const base = {
    order: {
      order_number: 1234,
      contact_phone: "48999999999",
      contact_name: "Maria Silva",
    },
    client: { email: "maria@ex.com", phone: "48999999999", name: "Maria Silva" },
    items: [{ total_price: 250, unit_price: null, quantity: 1 }],
  };

  it("gera event_id idempotente e custom_data correto", () => {
    const e = buildPurchaseEvent(base);
    expect(e.event_id).toBe("order_1234");
    expect(e.event_name).toBe("Purchase");
    expect(e.action_source).toBe("system_generated");
    expect(e.custom_data).toEqual({
      currency: "BRL",
      value: 250,
      order_id: "1234",
    });
  });

  it("preenche user_data com email, telefone e nome hasheados", () => {
    const e = buildPurchaseEvent(base);
    expect(e.user_data.em?.[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(e.user_data.ph?.[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(e.user_data.fn?.[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(e.user_data.ln?.[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(hasMatchKey(e)).toBe(true);
  });

  it("cai para os campos de contato do pedido quando não há client", () => {
    const e = buildPurchaseEvent({ ...base, client: null });
    expect(e.user_data.ph?.[0]).toBeDefined();
    expect(e.user_data.em).toBeUndefined();
  });

  it("hasMatchKey é false quando não há telefone nem email", () => {
    const e = buildPurchaseEvent({
      order: { order_number: 1, contact_phone: null, contact_name: null },
      client: null,
      items: [],
    });
    expect(hasMatchKey(e)).toBe(false);
  });
});

describe("buildLeadEvent", () => {
  const quote = {
    id: "3f1c9d2e-0000-4a11-b222-abcdef123456",
    client_name: "João da Silva Souza",
    client_email: "joao@clinica.com.br",
    client_phone: null,
    client_whatsapp: "(48) 99999-8888",
    estimated_value: 1349.9,
    utm_source: "facebook",
    utm_medium: "cpc",
    utm_campaign: "dentistas-07",
  };

  it("gera event_id idempotente a partir do id do orçamento", () => {
    const e = buildLeadEvent({ quote });
    expect(e.event_id).toBe(`quote_${quote.id}`);
    expect(e.event_name).toBe("Lead");
    expect(e.action_source).toBe("website");
  });

  it("leva o valor real do orçamento e as UTMs", () => {
    const e = buildLeadEvent({ quote });
    expect(e.custom_data.value).toBe(1349.9);
    expect(e.custom_data.currency).toBe("BRL");
    expect(e.custom_data.utm_source).toBe("facebook");
    expect(e.custom_data.utm_campaign).toBe("dentistas-07");
  });

  it("prefere o whatsapp ao telefone fixo", () => {
    const e = buildLeadEvent({
      quote: { ...quote, client_phone: "4833330000", client_whatsapp: "48999998888" },
    });
    expect(e.user_data.ph?.[0]).toBe(hashUserField("48999998888", "phone"));
  });

  it("usa o telefone fixo quando não há whatsapp", () => {
    const e = buildLeadEvent({
      quote: { ...quote, client_phone: "4833330000", client_whatsapp: null },
    });
    expect(e.user_data.ph?.[0]).toBe(hashUserField("4833330000", "phone"));
  });

  it("separa primeiro e último nome hasheados", () => {
    const e = buildLeadEvent({ quote });
    expect(e.user_data.fn?.[0]).toBe(hashUserField("joão", "name"));
    expect(e.user_data.ln?.[0]).toBe(hashUserField("da silva souza", "name"));
    expect(hasMatchKey(e)).toBe(true);
  });

  it("omite value quando estimated_value é nulo ou zero", () => {
    expect(buildLeadEvent({ quote: { ...quote, estimated_value: null } }).custom_data.value)
      .toBeUndefined();
    expect(buildLeadEvent({ quote: { ...quote, estimated_value: 0 } }).custom_data.value)
      .toBeUndefined();
  });

  it("omite UTMs ausentes em vez de mandar null", () => {
    const e = buildLeadEvent({
      quote: { ...quote, utm_source: null, utm_medium: null, utm_campaign: null },
    });
    expect(e.custom_data).not.toHaveProperty("utm_source");
    expect(e.custom_data).not.toHaveProperty("utm_medium");
    expect(e.custom_data).not.toHaveProperty("utm_campaign");
  });

  it("hasMatchKey é false sem email nem telefone", () => {
    const e = buildLeadEvent({
      quote: { ...quote, client_email: null, client_phone: null, client_whatsapp: null },
    });
    expect(hasMatchKey(e)).toBe(false);
  });
});

describe("sendEventToMeta", () => {
  const event = buildPurchaseEvent({
    order: { order_number: 9, contact_phone: "48999999999", contact_name: "A B" },
    client: null,
    items: [{ total_price: 10, unit_price: null, quantity: 1 }],
  });

  it("dry-run não chama fetch e devolve o payload com event_time", async () => {
    const fetchImpl = vi.fn();
    const r = await sendEventToMeta(event, {
      pixelId: "1",
      accessToken: "t",
      enabled: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.mode).toBe("dry-run");
    expect(r.ok).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((r.body as { data: { event_time: number }[] }).data[0].event_time).toBeTypeOf(
      "number",
    );
  });

  it("live mode chama a Graph API do pixel", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1 }),
    });
    const r = await sendEventToMeta(event, {
      pixelId: "PIX",
      accessToken: "TOK",
      enabled: true,
      eventTimeUnix: 1000,
      testEventCode: "TEST123",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.mode).toBe("live");
    expect(r.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/PIX/events");
    const sent = JSON.parse(init.body as string);
    expect(sent.test_event_code).toBe("TEST123");
    expect(sent.data[0].event_time).toBe(1000);
  });

  it("manda o token no header e NUNCA na URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1 }),
    });
    await sendEventToMeta(event, {
      pixelId: "PIX",
      accessToken: "TOKEN_SECRETO",
      enabled: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    // URL entra em log de servidor, proxy e APM — o token não pode aparecer lá.
    expect(url).not.toContain("TOKEN_SECRETO");
    expect(url).not.toContain("access_token");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer TOKEN_SECRETO",
    );
  });
});
