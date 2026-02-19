import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

const supabase = createClient();

type PublicQuoteRow = Database["public"]["Tables"]["public_quotes"]["Row"];
type PublicQuoteInsert = Database["public"]["Tables"]["public_quotes"]["Insert"];
type PublicQuoteUpdate = Database["public"]["Tables"]["public_quotes"]["Update"];

export type QuoteStatus = "PENDENTE" | "CONTACTADO" | "CONCLUIDO" | "APROVADO" | "REJEITADO";

export interface QuoteListItem {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  items: unknown;
  estimated_value: number | null;
  status: QuoteStatus;
  created_at: string;
}

export interface GetQuotesParams {
  status?: QuoteStatus;
  page?: number;
  limit?: number;
}

export interface GetQuotesResult {
  data: PublicQuoteRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getQuotes(
  params?: GetQuotesParams
): Promise<GetQuotesResult> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;

  let query = supabase
    .from("public_quotes")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params?.status) {
    query = query.eq("status", params.status);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) throw error;

  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: data ?? [],
    total,
    page,
    limit,
    totalPages,
  };
}

export async function getQuoteById(id: string) {
  const { data, error } = await supabase
    .from("public_quotes")
    .select(`
      *,
      assigned_user:profiles!public_quotes_assigned_to_fkey(id, full_name, avatar_url, email)
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

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
  items: unknown;
  personalization?: unknown;
  estimated_value?: number | null;
}

export async function createPublicQuote(data: CreatePublicQuoteData) {
  const { data: quote, error } = await supabase
    .from("public_quotes")
    .insert({
      client_name: data.client_name,
      client_email: data.client_email ?? null,
      client_phone: data.client_phone ?? null,
      client_whatsapp: data.client_whatsapp ?? null,
      client_document: data.client_document ?? null,
      client_city: data.client_city ?? null,
      client_state: data.client_state ?? null,
      client_zip_code: data.client_zip_code ?? null,
      client_street: data.client_street ?? null,
      client_number: data.client_number ?? null,
      client_complement: data.client_complement ?? null,
      client_neighborhood: data.client_neighborhood ?? null,
      client_social_media: data.client_social_media ?? null,
      client_logo_url: data.client_logo_url ?? null,
      items: data.items,
      personalization: data.personalization ?? null,
      estimated_value: data.estimated_value ?? null,
      status: "PENDENTE",
    } as PublicQuoteInsert)
    .select()
    .single();

  if (error) throw error;
  return quote;
}

export async function updateQuote(id: string, data: PublicQuoteUpdate) {
  const { data: quote, error } = await supabase
    .from("public_quotes")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return quote;
}

export async function approveQuote(id: string) {
  const { data: quote, error: quoteError } = await supabase
    .from("public_quotes")
    .select("*")
    .eq("id", id)
    .single();

  if (quoteError || !quote) throw quoteError ?? new Error("Orçamento não encontrado");

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const { data: client } = await supabase
    .from("clients")
    .insert({
      person_type: "FISICA",
      name: quote.client_name,
      email: quote.client_email,
      phone: quote.client_phone ?? quote.client_whatsapp,
      document: quote.client_document,
      zip_code: quote.client_zip_code,
      street: quote.client_street,
      number: quote.client_number,
      complement: quote.client_complement,
      neighborhood: quote.client_neighborhood,
      city: quote.client_city,
      state: quote.client_state,
      logo_url: quote.client_logo_url,
      created_by: userId,
    })
    .select()
    .single();

  if (!client) throw new Error("Erro ao criar cliente");

  const items = (quote.items as { product_id: string; product_name: string; quantity: number; unit_price: number }[]) ?? [];
  const totalValue = items.reduce((sum, i) => sum + (i.unit_price ?? 0) * i.quantity, 0);

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
      title: `Orçamento - ${quote.client_name}`,
      description: `Convertido do orçamento público em ${new Date().toLocaleDateString("pt-BR")}`,
      client_id: client.id,
      status: "FAZER",
      order_type: "ORCAMENTO_PUBLICO",
      priority: "NORMAL",
      assigned_to: quote.assigned_to ?? userId,
      created_by: userId,
      position,
    })
    .select()
    .single();

  if (orderError || !order) throw orderError ?? new Error("Erro ao criar pedido");

  for (const item of items) {
    await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.quantity,
      personalization: quote.personalization,
    });
  }

  await supabase.from("order_labels").insert({
    order_id: order.id,
    label: "ORCAMENTO_PUBLICO",
    added_by: userId,
  });

  await supabase
    .from("public_quotes")
    .update({
      status: "APROVADO",
      order_id: order.id,
      existing_client_id: client.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return { order, client };
}

export async function rejectQuote(id: string, reason?: string) {
  const { data: existing } = await supabase
    .from("public_quotes")
    .select("internal_notes")
    .eq("id", id)
    .single();

  const updatedNotes = reason
    ? (existing?.internal_notes ?? "") + (existing?.internal_notes ? "\n\n" : "") + `Rejeitado: ${reason}`
    : existing?.internal_notes ?? null;

  const { data: quote, error } = await supabase
    .from("public_quotes")
    .update({
      status: "REJEITADO",
      ...(reason && { internal_notes: updatedNotes }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return quote;
}
