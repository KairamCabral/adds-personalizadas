"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";

interface OrderHistoryProps {
  orderId: string;
}

interface HistoryEntry {
  id: string;
  order_id: string;
  user_id: string | null;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user: { id: string; full_name: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  status_changed: "alterou o status",
  assigned: "atribuiu",
  label_added: "adicionou etiqueta",
  label_removed: "removeu etiqueta",
  created: "criou",
  updated: "atualizou",
  comment_added: "adicionou comentário",
  attachment_added: "adicionou anexo",
  artwork_uploaded: "enviou arte",
  artwork_approved: "arte aprovada",
  artwork_revision_requested: "ajuste solicitado na arte",
};

async function fetchOrderHistory(orderId: string): Promise<HistoryEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("order_history")
    .select("*, user:profiles!order_history_user_id_fkey(id, full_name)")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
.eq("order_id", orderId as any)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as HistoryEntry[];
}

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function OrderHistory({ orderId }: OrderHistoryProps) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["order-history", orderId],
    queryFn: () => fetchOrderHistory(orderId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Carregando histórico...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum registro no histórico.
      </p>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
      <ul className="space-y-0">
        {entries.map((entry, i) => (
          <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="relative z-10 mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-background bg-primary" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm">
                <span className="font-medium">
                  {entry.user?.full_name ?? "Sistema"}
                </span>{" "}
                {getActionLabel(entry.action)}
                {(entry.old_value || entry.new_value) && (
                  <span className="text-muted-foreground">
                    {" "}
                    {entry.old_value && (
                      <>
                        <span className="font-mono">{entry.old_value}</span>
                        {entry.new_value && " → "}
                      </>
                    )}
                    {entry.new_value && (
                      <span className="font-mono">{entry.new_value}</span>
                    )}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(entry.created_at)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
