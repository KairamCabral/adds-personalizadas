import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database.types";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "LABEL_CHANGE"
  | "ARTWORK_UPLOAD"
  | "ARTWORK_APPROVE"
  | "ARTWORK_REJECT"
  | "SYNC_TINY"
  | "EXPORT";

export interface AuditFilters {
  action?: AuditAction;
  entity_type?: string;
  user_id?: string;
}

export interface AuditLogWithUser {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: unknown;
  new_data: unknown;
  created_at: string;
  user: { full_name: string } | null;
}

export interface GetAuditLogsResult {
  logs: AuditLogWithUser[];
  total: number;
}

export async function getAuditLogs(
  filters?: AuditFilters,
  page = 1,
  pageSize = 20
): Promise<GetAuditLogsResult> {
  const supabase = createClient();

  let query = supabase
    .from("audit_logs")
    .select("*, user:profiles!audit_logs_user_id_fkey(full_name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filters?.action) {
    query = query.eq("action", filters.action);
  }
  if (filters?.entity_type) {
    query = query.eq("entity_type", filters.entity_type);
  }
  if (filters?.user_id) {
    query = query.eq("user_id", filters.user_id);
  }

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    logs: (data ?? []) as AuditLogWithUser[],
    total: count ?? 0,
  };
}

export async function logAction(
  action: AuditAction,
  entityType: string,
  entityId?: string | null,
  oldData?: unknown,
  newData?: unknown
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("audit_logs").insert({
    user_id: user?.id ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    old_data: (oldData ?? null) as Json | null,
    new_data: (newData ?? null) as Json | null,
  });
}
