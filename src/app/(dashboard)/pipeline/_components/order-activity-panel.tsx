"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { addComment, markCommentAsRead, markHistoryAsRead } from "@/services/orders.service";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";
import { Send, PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface OrderActivityPanelProps {
  orderId: string;
  onToggleDetails?: () => void;
  showDetails?: boolean;
}

interface CommentUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  content: string;
  is_system: boolean | null;
  created_at: string;
  read_at: string | null;
  read_by: string | null;
  user: CommentUser | null;
  read_by_profile: { id: string; full_name: string } | null;
}

interface HistoryEntry {
  id: string;
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
  created: "criou o pedido",
  updated: "atualizou",
  comment_added: "adicionou comentário",
  attachment_added: "anexou",
  artwork_uploaded: "enviou arte",
  artwork_approved: "arte aprovada",
  artwork_revision_requested: "Ajuste solicitado",
};

function parseRevisionRequested(newValue: string | null): { prefix: string; userName: string; feedback: string } | null {
  if (!newValue) return null;
  const match = newValue.match(/^(.+?) por (.+?): (.+)$/);
  if (!match) return null;
  return { prefix: match[1], userName: match[2], feedback: match[3] };
}

async function fetchComments(orderId: string): Promise<Comment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("*, user:profiles!comments_user_id_fkey(id, full_name, avatar_url), read_by_profile:profiles!comments_read_by_fkey(id, full_name)")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq("order_id", orderId as any)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Comment[];
}

interface HistoryRead {
  history_id: string;
  read_at: string;
  read_by_profile: { full_name: string } | null;
}

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

async function fetchHistoryReads(historyIds: string[]): Promise<Map<string, HistoryRead>> {
  if (historyIds.length === 0) return new Map();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return new Map();
  const { data } = await supabase
    .from("order_history_reads")
    .select("history_id, read_at, read_by_profile:profiles!order_history_reads_user_id_fkey(full_name)")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .in("history_id", historyIds as any)
    // Per-user: cada um marca leitura por si — sem filtro vinha o read mais
    // antigo de qualquer pessoa, deixando o checkbox disabled pros demais.
    .eq("user_id", user.id)
    .order("read_at", { ascending: true });
  const map = new Map<string, HistoryRead>();
  for (const row of data ?? []) {
    const r = row as unknown as HistoryRead & { history_id: string };
    if (!map.has(r.history_id)) map.set(r.history_id, r);
  }
  return map;
}

type TimelineItem =
  | { type: "comment"; data: Comment }
  | { type: "history"; data: HistoryEntry };

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function OrderActivityPanel({
  orderId,
  onToggleDetails,
  showDetails = true,
}: OrderActivityPanelProps) {
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["comments", orderId],
    queryFn: () => fetchComments(orderId),
    enabled: !!orderId,
  });

  const { data: historyEntries = [], isLoading: historyLoading } = useQuery({
    queryKey: ["order-history", orderId],
    queryFn: () => fetchOrderHistory(orderId),
    enabled: !!orderId,
  });

  const revisionHistoryIds = historyEntries
    .filter((e) => e.action === "artwork_revision_requested")
    .map((e) => e.id);
  const { data: historyReadsMap = new Map<string, HistoryRead>() } = useQuery({
    queryKey: ["history-reads", orderId, revisionHistoryIds.join(",")],
    queryFn: () => fetchHistoryReads(revisionHistoryIds),
    enabled: revisionHistoryIds.length > 0,
  });

  const addMutation = useMutation({
    mutationFn: (text: string) => addComment(orderId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-history", orderId] });
      setContent("");
      toast.success("Comentário adicionado.");
    },
    onError: () => {
      toast.error("Erro ao adicionar comentário.");
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (commentId: string) => markCommentAsRead(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", orderId] });
      toast.success("Marcado como lido.");
    },
    onError: () => {
      toast.error("Erro ao marcar como lido.");
    },
  });

  const markHistoryReadMutation = useMutation({
    mutationFn: (historyId: string) => markHistoryAsRead(historyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history-reads", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-history", orderId] });
      toast.success("Marcado como lido.");
    },
    onError: () => {
      toast.error("Erro ao marcar como lido.");
    },
  });

  const isLoading = commentsLoading || historyLoading;

  const timeline: TimelineItem[] = [
    ...comments.map((c) => ({ type: "comment" as const, data: c })),
    ...historyEntries
      .filter((e) => e.action !== "comment_added")
      .map((e) => ({ type: "history" as const, data: e })),
  ].sort((a, b) => {
    const dateA = a.type === "comment" ? a.data.created_at : a.data.created_at;
    const dateB = b.type === "comment" ? b.data.created_at : b.data.created_at;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || addMutation.isPending) return;
    addMutation.mutate(trimmed);
  }

  return (
    <div className="flex h-full flex-col bg-muted/20">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 pr-14">
        <h3 className="text-base font-semibold text-foreground">
          Comentários e atividade
        </h3>
        {onToggleDetails && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleDetails}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {showDetails ? (
              <>
                <PanelLeftClose className="h-3.5 w-3.5" />
                Ocultar detalhes
              </>
            ) : (
              <>
                <PanelLeftOpen className="h-3.5 w-3.5" />
                Mostrar detalhes
              </>
            )}
          </Button>
        )}
      </div>

      <div className="flex flex-1 flex-col min-h-0">
        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-b border-border p-4"
        >
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escrever um comentário..."
            className="min-h-[72px] resize-none border-border bg-background text-sm"
            disabled={addMutation.isPending}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!content.trim() || addMutation.isPending}
            className="mt-2 w-full gap-2"
          >
            <Send className="h-3.5 w-3.5" />
            {addMutation.isPending ? "Enviando..." : "Enviar"}
          </Button>
        </form>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Carregando...
              </p>
            ) : timeline.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum comentário ou atividade ainda.
              </p>
            ) : (
              timeline.map((item) => {
                if (item.type === "comment") {
                  const comment = item.data;
                  return (
                    <div
                      key={`comment-${comment.id}`}
                      className="flex gap-3 rounded-lg border-l-4 border-primary bg-primary/10 p-4 shadow-md"
                    >
                      {!comment.is_system && comment.user && (
                        <Avatar className="h-8 w-8 shrink-0">
                          {comment.user.avatar_url && (
                            <AvatarImage src={comment.user.avatar_url} />
                          )}
                          <AvatarFallback className="text-xs">
                            {getInitials(comment.user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="min-w-0 flex-1">
                        {!comment.is_system && comment.user && (
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {comment.user.full_name}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatRelativeTime(comment.created_at)}
                            </span>
                          </div>
                        )}
                        <p
                          className={
                            comment.is_system
                              ? "text-sm italic text-muted-foreground"
                              : "text-sm font-medium leading-relaxed text-foreground"
                          }
                        >
                          {comment.content}
                        </p>
                        {!comment.is_system && (
                          <div className="mt-2 flex items-center gap-2">
                            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                              <Checkbox
                                checked={!!comment.read_at}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    markReadMutation.mutate(comment.id);
                                  }
                                }}
                                disabled={markReadMutation.isPending}
                              />
                              <span>
                                {comment.read_at
                                  ? `Lido por ${comment.read_by_profile?.full_name ?? "—"}`
                                  : "Marcar como lido"}
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                const entry = item.data;
                const isRevision = entry.action === "artwork_revision_requested";
                const parsed = isRevision ? parseRevisionRequested(entry.new_value) : null;
                const readInfo = isRevision ? historyReadsMap.get(entry.id) : null;

                return (
                  <div
                    key={`history-${entry.id}`}
                    className={`flex gap-3 rounded-lg px-3 py-3 ${
                      isRevision ? "border-l-4 border-adds-orange bg-adds-orange/10" : "bg-muted/40"
                    }`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-muted text-xs">
                        {entry.user
                          ? getInitials(entry.user.full_name)
                          : "S"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">
                          {entry.user?.full_name ?? "Sistema"}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {getActionLabel(entry.action)}
                          {isRevision && parsed ? (
                            <>
                              {" "}
                              <span className="text-foreground">{parsed.prefix}</span>
                              {" por "}
                              <span className="font-semibold text-adds-orange">{parsed.userName}</span>
                              {": "}
                              <span className="font-medium text-adds-orange">{parsed.feedback}</span>
                            </>
                          ) : (
                            (entry.old_value || entry.new_value) && (
                              <>
                                {" "}
                                {entry.old_value && (
                                  <span className="font-mono text-xs">
                                    {entry.old_value}
                                    {entry.new_value && " → "}
                                  </span>
                                )}
                                {entry.new_value && (
                                  <span className="font-mono text-xs">
                                    {entry.new_value}
                                  </span>
                                )}
                              </>
                            )
                          )}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatRelativeTime(entry.created_at)}
                      </p>
                      {isRevision && (
                        <div className="mt-2 flex items-center gap-2">
                          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                            <Checkbox
                              checked={!!readInfo}
                              onCheckedChange={(checked) => {
                                if (checked && !readInfo) {
                                  markHistoryReadMutation.mutate(entry.id);
                                }
                              }}
                              disabled={!!readInfo || markHistoryReadMutation.isPending}
                            />
                            <span>
                              {readInfo ? "Lido" : "Marcar como lido"}
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
