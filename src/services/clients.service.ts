import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import type { Client } from "@/types/database.types";

const supabase = createSupabaseClient();

type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

export interface GetClientsParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetClientsResult {
  data: Client[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getClients(
  params?: GetClientsParams
): Promise<GetClientsResult> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const search = params?.search?.trim();

  let query = supabase.from("clients").select("*", { count: "exact" });

  if (search) {
    query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%`);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, error, count } = await query
    .order("name", { ascending: true })
    .range(from, to);

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

export async function getClientsCount(): Promise<number> {
  const { count, error } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function getClientById(id: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createClient(data: ClientInsert) {
  const { data: client, error } = await supabase
    .from("clients")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return client;
}

export async function updateClient(id: string, data: ClientUpdate) {
  const { data: client, error } = await supabase
    .from("clients")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return client;
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// Importação em massa
// ============================================================

export interface BulkImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

export type ImportableClient = Pick<
  ClientInsert,
  | "name"
  | "email"
  | "phone"
  | "company"
  | "document"
  | "person_type"
  | "zip_code"
  | "street"
  | "number"
  | "complement"
  | "neighborhood"
  | "city"
  | "state"
  | "notes"
>;

/**
 * Insere clientes em batches de 50, ignorando duplicatas por email ou document.
 * Retorna contadores de importados, ignorados e erros.
 */
export async function bulkImportClients(
  rows: ImportableClient[],
  onProgress?: (pct: number) => void
): Promise<BulkImportResult> {
  if (rows.length === 0) return { imported: 0, skipped: 0, errors: 0 };

  // 1. Coletar emails e documentos existentes (documentos normalizados para comparação)
  const emails = [...new Set(rows.filter((r) => r.email).map((r) => r.email!))];

  const existingEmails = new Set<string>();
  const existingDocsNormalized = new Set<string>();

  if (emails.length > 0) {
    const { data } = await supabase
      .from("clients")
      .select("email")
      .in("email", emails);
    (data ?? []).forEach((r) => r.email && existingEmails.add(r.email));
  }

  const docsFromRows = rows.filter((r) => r.document).map((r) => (r.document ?? "").replace(/\D/g, ""));
  if (docsFromRows.some((d) => d.length >= 11)) {
    const { data } = await supabase.from("clients").select("document").not("document", "is", null);
    (data ?? []).forEach((r) => {
      const norm = (r.document ?? "").replace(/\D/g, "");
      if (norm.length >= 11) existingDocsNormalized.add(norm);
    });
  }

  // 2. Separar linhas que podem ser inseridas
  const toInsert: ClientInsert[] = [];
  let skipped = 0;

  for (const row of rows) {
    const isDupEmail = !!(row.email && existingEmails.has(row.email));
    const docNorm = (row.document ?? "").replace(/\D/g, "");
    const isDupDoc = !!(docNorm.length >= 11 && existingDocsNormalized.has(docNorm));
    if (isDupEmail || isDupDoc) {
      skipped++;
    } else {
      toInsert.push(row as ClientInsert);
      // Marcar localmente para evitar duplicatas dentro do mesmo arquivo
      if (row.email) existingEmails.add(row.email);
      if (docNorm.length >= 11) existingDocsNormalized.add(docNorm);
    }
  }

  // 3. Inserir em batches
  const BATCH = 50;
  let imported = 0;
  let errors = 0;

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from("clients").insert(batch);
    if (error) {
      errors += batch.length;
    } else {
      imported += batch.length;
    }
    onProgress?.(Math.round(((i + batch.length) / toInsert.length) * 100));
  }

  return { imported, skipped, errors };
}

export async function searchClients(query: string, limit = 20) {
  const search = query?.trim();
  let request = supabase
    .from("clients")
    .select("id, name, company, logo_url")
    .order("name", { ascending: true })
    .limit(limit);

  if (search) {
    request = request.or(`name.ilike.%${search}%,company.ilike.%${search}%`);
  }

  const { data, error } = await request;

  if (error) throw error;
  return data ?? [];
}
