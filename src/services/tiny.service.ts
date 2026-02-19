import { createClient } from "@/lib/supabase/client";

export interface TinySyncLog {
  id: string;
  entity_type: string;
  entity_id: string | null;
  tiny_id: number | null;
  direction: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface GetSyncLogsResult {
  logs: TinySyncLog[];
  total: number;
}

export async function getSyncLogs(
  entity?: string,
  status?: string,
  page = 1,
  pageSize = 20
): Promise<GetSyncLogsResult> {
  const supabase = createClient();

  let query = supabase
    .from("tiny_sync_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (entity) {
    query = query.eq("entity_type", entity);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    logs: (data ?? []) as TinySyncLog[],
    total: count ?? 0,
  };
}

export interface IntegrationsStatus {
  tiny: boolean;
  resend: boolean;
}

export async function getIntegrationsStatus(): Promise<IntegrationsStatus> {
  try {
    const res = await fetch("/api/integrations/status");
    const data = await res.json();
    return { tiny: !!data.tiny, resend: !!data.resend };
  } catch {
    return { tiny: false, resend: false };
  }
}

export async function getTinyConnectionStatus(): Promise<boolean> {
  try {
    const res = await fetch("/api/tiny/status");
    const data = await res.json();
    return data.connected === true;
  } catch {
    return false;
  }
}

export function getTinyAuthUrl(): string {
  return "/api/tiny/auth";
}

export async function disconnectTiny(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/tiny/disconnect", { method: "POST" });
    const data = await res.json();
    return data;
  } catch {
    return { success: false, error: "Erro ao desconectar." };
  }
}

export async function syncRecentClients(): Promise<{
  success: boolean;
  message?: string;
  synced?: number;
  pagesProcessed?: number;
  earlyExit?: boolean;
}> {
  const res = await fetch("/api/tiny/sync-recent", { method: "POST" });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao sincronizar contatos recentes");
  }

  return res.json();
}

export async function syncClients(): Promise<{
  success: boolean;
  message?: string;
  synced?: number;
}> {
  const res = await fetch("/api/tiny/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity: "clients" }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao sincronizar clientes");
  }

  return res.json();
}

export async function syncProducts(): Promise<{
  success: boolean;
  message?: string;
  synced?: number;
}> {
  const res = await fetch("/api/tiny/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity: "products" }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao sincronizar produtos");
  }

  return res.json();
}

export async function syncOrders(): Promise<{
  success: boolean;
  message?: string;
  synced?: number;
  skipped?: number;
}> {
  const res = await fetch("/api/tiny/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity: "orders" }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro ao sincronizar pedidos");
  }

  return res.json();
}
