"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { addComment } from "@/services/orders.service";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

interface OrderCommentsProps {
  orderId: string;
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
  user: CommentUser | null;
}

async function fetchComments(orderId: string): Promise<Comment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("*, user:profiles!comments_user_id_fkey(id, full_name, avatar_url)")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
.eq("order_id", orderId as any)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Comment[];
}

export function OrderComments({ orderId }: OrderCommentsProps) {
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", orderId],
    queryFn: () => fetchComments(orderId),
    enabled: !!orderId,
  });

  const addMutation = useMutation({
    mutationFn: (text: string) => addComment(orderId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setContent("");
      toast.success("Comentário adicionado.");
    },
    onError: () => {
      toast.error("Erro ao adicionar comentário.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || addMutation.isPending) return;
    addMutation.mutate(trimmed);
  }

  if (isLoading) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        Carregando comentários...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum comentário ainda. Seja o primeiro a comentar.
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={comment.is_system ? "flex gap-2 text-sm italic text-muted-foreground" : "flex gap-2"}
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
              <div className="flex-1 min-w-0">
                {!comment.is_system && comment.user && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
                    <span className="font-medium text-foreground">
                      {comment.user.full_name}
                    </span>
                    <span>{formatRelativeTime(comment.created_at)}</span>
                  </div>
                )}
                <p
                  className={
                    comment.is_system
                      ? "text-sm italic text-muted-foreground"
                      : "text-sm"
                  }
                >
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Adicionar comentário..."
          className="min-h-[80px] resize-none"
          disabled={addMutation.isPending}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!content.trim() || addMutation.isPending}
          className="self-end"
        >
          {addMutation.isPending ? "Enviando..." : "Enviar"}
        </Button>
      </form>
    </div>
  );
}
