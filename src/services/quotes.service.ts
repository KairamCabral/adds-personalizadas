import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

export type QuoteStatus =
  | "PENDENTE"
  | "CONTACTADO"
  | "CONCLUIDO"
  | "APROVADO"
  | "REJEITADO";

export interface QuoteItem {
  product_id?: string;
  product_name: string;
  quantity: number;
  colors?: string[];
  custom_color?: string | null;
  /** Quantidade por cor (corKey -> quantidade). Quando presente, total = soma dos valores. */
  quantity_per_color?: Record<string, number>;
}

export type ArtworkMode = "use_last" | "request_creation" | "do_it_yourself";

export interface QuotePersonalization {
  artwork_mode?: ArtworkMode | null;
  print_color?: string;
  custom_color?: string | null;
  notes?: string;
  /** Campos enviados pelo formulário público */
  cor_impressao?: string;
  notas_especiais?: string;
  /** Customizações DIY por produto */
  customizations?: {
    product_id: string;
    line1: string;
    line2: string;
    print_color: string;
    has_logo: boolean;
  }[];
}

type PublicQuoteRow = Database["public"]["Tables"]["public_quotes"]["Row"];
type PublicQuoteInsert = Database["public"]["Tables"]["public_quotes"]["Insert"];

export interface PublicQuote extends Omit<PublicQuoteRow, "items" | "personalization"> {
  items: QuoteItem[];
  personalization: QuotePersonalization | null;
  assigned_profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export interface QuoteFilters {
  status?: QuoteStatus | "ALL" | "PENDENTE_CONTACTADO";
  search?: string;
  page?: number;
  limit?: number;
}

export interface QuoteUpdateData {
  status?: QuoteStatus;
  assigned_to?: string | null;
  internal_notes?: string | null;
  estimated_value?: number | null;
}

const PAGE_SIZE = 20;

/**
 * Busca orçamentos via API (usa admin client no servidor).
 * Evita erro 400 do PostgREST quando a query é feita direto do cliente.
 */
export async function getQuotesViaApi(filters: QuoteFilters = {}) {
  const { status = "ALL", search, page = 1, limit = PAGE_SIZE } = filters;
  const params = new URLSearchParams({
    status: String(status),
    search: search ?? "",
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(`/api/quotes?${params}`);
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? "Erro ao carregar orçamentos");
  }
  return res.json() as Promise<{
    quotes: PublicQuote[];
    total: number;
    page: number;
    totalPages: number;
  }>;
}

// ============================================
// LISTAR ORÇAMENTOS COM FILTROS E PAGINAÇÃO
// ============================================
export async function getQuotes(filters: QuoteFilters = {}) {
  const supabase = createClient();
  const { status = "ALL", search, page = 1, limit = PAGE_SIZE } = filters;

  let query = supabase
    .from("public_quotes")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status && status !== "ALL") {
    if (status === "PENDENTE_CONTACTADO") {
      query = query.in("status", ["PENDENTE", "CONTACTADO"]);
    } else {
      query = query.eq("status", status);
    }
  }

  if (search && search.trim().length >= 2) {
    const sanitized = search.trim().replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.or(
      `client_name.ilike.%${sanitized}%,client_email.ilike.%${sanitized}%,client_phone.ilike.%${sanitized}%,client_document.ilike.%${sanitized}%`
    );
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  const quotes = (data ?? []) as unknown as PublicQuote[];

  const assignedIds = [...new Set(quotes.map((q) => q.assigned_to).filter(Boolean))] as string[];
  let profilesMap: Record<string, { id: string; full_name: string; avatar_url: string | null }> = {};
  if (assignedIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", assignedIds);
    if (profiles) {
      profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
    }
  }

  const quotesWithProfile = quotes.map((q) => ({
    ...q,
    assigned_profile: q.assigned_to && profilesMap[q.assigned_to]
      ? profilesMap[q.assigned_to]
      : null,
  }));

  return {
    quotes: quotesWithProfile,
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

// ============================================
// BUSCAR ORÇAMENTO POR ID
// ============================================
export async function getQuoteById(id: string): Promise<PublicQuote> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("public_quotes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  const quote = data as unknown as PublicQuote;

  if (quote.assigned_to) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", quote.assigned_to)
      .single();
    return { ...quote, assigned_profile: profile ?? null };
  }
  return { ...quote, assigned_profile: null };
}

// ============================================
// ATUALIZAR ORÇAMENTO (status, notas, responsável, valor)
// ============================================
export async function updateQuote(
  id: string,
  data: QuoteUpdateData
): Promise<PublicQuote> {
  const supabase = createClient();

  const { data: updated, error } = await supabase
    .from("public_quotes")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return updated as unknown as PublicQuote;
}

// ============================================
// APROVAR ORÇAMENTO → CRIAR PEDIDO NO KANBAN
// ============================================
export async function approveQuote(quoteId: string) {
  const supabase = createClient();

  const { data: quote, error: fetchError } = await supabase
    .from("public_quotes")
    .select("*")
    .eq("id", quoteId)
    .single();

  if (fetchError) throw fetchError;

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const personalization = quote.personalization as QuotePersonalization | null;
  let clientId = quote.existing_client_id;

  if (!clientId) {
    const { data: newClient, error: clientError } = await supabase
      .from("clients")
      .insert({
        person_type: "FISICA",
        name: quote.client_name,
        email: quote.client_email,
        phone: quote.client_phone ?? quote.client_whatsapp,
        document: quote.client_document,
        city: quote.client_city,
        state: quote.client_state,
        zip_code: quote.client_zip_code,
        street: quote.client_street,
        number: quote.client_number,
        complement: quote.client_complement,
        neighborhood: quote.client_neighborhood,
        logo_url: quote.client_logo_url,
        created_by: userId,
      })
      .select()
      .single();

    if (clientError) throw clientError;
    clientId = newClient.id;
  }

  const { data: maxPos } = await supabase
    .from("orders")
    .select("position")
    .eq("status", "FAZER")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? 0) + 1;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      title: quote.client_name,
      description: personalization?.notes ?? null,
      client_id: clientId,
      status: "FAZER",
      order_type: "ORCAMENTO_PUBLICO",
      priority: "NORMAL",
      start_date: new Date().toISOString().split("T")[0],
      position,
      assigned_to: quote.assigned_to ?? userId,
      created_by: userId,
    })
    .select()
    .single();

  if (orderError) throw orderError;

  const items = (quote.items as unknown as QuoteItem[]) ?? [];
  if (Array.isArray(items) && items.length > 0) {
    const orderItems: {
      order_id: string;
      product_id: string | null;
      product_name: string;
      quantity: number;
      personalization: { colors: string[]; custom_color: string | null; notes: string };
      unit_price: null;
      total_price: null;
    }[] = [];

    for (const item of items) {
      const qpc = item.quantity_per_color && Object.keys(item.quantity_per_color).length > 0
        ? item.quantity_per_color
        : null;

      if (qpc) {
        for (const [colorKey, qty] of Object.entries(qpc)) {
          if (qty > 0) {
            orderItems.push({
              order_id: order.id,
              product_id: item.product_id ?? null,
              product_name: item.product_name,
              quantity: qty,
              personalization: {
                colors: [colorKey],
                custom_color: item.custom_color ?? null,
                notes: personalization?.notes ?? "",
              },
              unit_price: null,
              total_price: null,
            });
          }
        }
      } else {
        orderItems.push({
          order_id: order.id,
          product_id: item.product_id ?? null,
          product_name: item.product_name,
          quantity: item.quantity,
          personalization: {
            colors: item.colors ?? [],
            custom_color: item.custom_color ?? null,
            notes: personalization?.notes ?? "",
          },
          unit_price: null,
          total_price: null,
        });
      }
    }

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw itemsError;
  }

  const updatePayload: Record<string, unknown> = {
    status: "APROVADO",
    order_id: order.id,
    updated_at: new Date().toISOString(),
  };
  if (clientId && !quote.existing_client_id) {
    updatePayload.existing_client_id = clientId;
  }

  const { error: updateError } = await supabase
    .from("public_quotes")
    .update(updatePayload)
    .eq("id", quoteId);

  if (updateError) throw updateError;

  await supabase.from("order_labels").insert({
    order_id: order.id,
    label: "ORCAMENTO_PUBLICO",
    added_by: userId,
  });

  if (quote.client_logo_url) {
    const ext = quote.client_logo_url.split(".").pop()?.split("?")[0] || "png";
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    await supabase.from("attachments").insert({
      order_id: order.id,
      file_url: quote.client_logo_url,
      file_name: `logo-cliente.${ext}`,
      file_size: null,
      file_type: mimeTypes[ext.toLowerCase()] ?? null,
      uploaded_by: userId,
    });
  }

  return order;
}

// ============================================
// REJEITAR ORÇAMENTO
// ============================================
export async function rejectQuote(
  quoteId: string,
  reason?: string
): Promise<PublicQuote> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("public_quotes")
    .update({
      status: "REJEITADO",
      internal_notes: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PublicQuote;
}

// ============================================
// MARCAR COMO CONTACTADO
// ============================================
export async function markAsContacted(quoteId: string): Promise<PublicQuote> {
  return updateQuote(quoteId, { status: "CONTACTADO" });
}

// ============================================
// CONTAGEM POR STATUS (para badges)
// ============================================
export async function getQuoteCounts() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("public_quotes")
    .select("status");

  if (error) throw error;

  const counts = {
    PENDENTE: 0,
    CONTACTADO: 0,
    CONCLUIDO: 0,
    APROVADO: 0,
    REJEITADO: 0,
    TOTAL: data?.length ?? 0,
  };

  data?.forEach((q) => {
    if (q.status in counts) {
      counts[q.status as keyof typeof counts]++;
    }
  });

  return counts;
}

// ============================================
// CRIAR ORÇAMENTO (formulário público)
// ============================================
export interface CreatePublicQuoteData {
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  client_whatsapp?: string | null;
  client_document?: string | null;
  client_city?: string | null;
  client_state?: string | null;
  client_zip_code?: string | null;
  client_street?: string | null;
  client_number?: string | null;
  client_complement?: string | null;
  client_neighborhood?: string | null;
  client_social_media?: string | null;
  client_logo_url?: string | null;
  is_existing_client?: boolean;
  existing_client_id?: string | null;
  items: QuoteItem[] | unknown;
  personalization?: QuotePersonalization | null;
  estimated_value?: number | null;
}

/**
 * Envia o orçamento do formulário público via API (service role no servidor),
 * evitando 401 por uso da anon key no cliente.
 */
export async function createPublicQuote(data: CreatePublicQuoteData) {
  const res = await fetch("/api/quote/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const json = (await res.json().catch(() => ({}))) as {
    quote?: PublicQuoteRow;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(json.error ?? "Erro ao enviar orçamento");
  }

  if (!json.quote) {
    throw new Error("Resposta inválida do servidor");
  }

  return json.quote;
}

// ============================================
// BUSCAR PRODUTOS ATIVOS (formulário público, sem auth)
// ============================================
export async function getActiveProducts() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, description, price, image_url, print_area_image_url, category, available_colors, allows_custom_color"
    )
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

// ============================================
// UPLOAD DE LOGO (via API route existente)
// ============================================
export async function uploadQuoteLogo(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/quote/upload-logo", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Falha no upload");
  }
  const { url } = (await res.json()) as { url?: string };
  if (!url) throw new Error("URL não retornada");
  return url;
}
