"use client";
// @ts-nocheck - Supabase types out of sync with schema

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ListTodo } from "lucide-react";
import { toast } from "sonner";

interface OrderChecklistProps {
  orderId: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  is_completed: boolean;
  position: number;
}

interface Checklist {
  id: string;
  title: string;
  position: number;
  items: ChecklistItem[];
}

async function fetchChecklists(orderId: string): Promise<Checklist[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("checklists")
    .select("*, items:checklist_items(*)")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq("order_id", orderId as any)
    .order("position");

  if (error) throw error;

  const rows = (data ?? []) as Array<{ items?: ChecklistItem[] } & Record<string, unknown>>;
  return rows.map((c) => ({
    ...c,
    items: (c.items ?? []).sort(
      (a: ChecklistItem, b: ChecklistItem) => a.position - b.position
    ),
  })) as unknown as Checklist[];
}

export function OrderChecklist({ orderId }: OrderChecklistProps) {
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: checklists = [], isLoading } = useQuery({
    queryKey: ["checklists", orderId],
    queryFn: () => fetchChecklists(orderId),
    enabled: !!orderId,
  });

  const addChecklistMutation = useMutation({
    mutationFn: async (title: string) => {
      const { data: maxPos } = await supabase
        .from("checklists")
        .select("position")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq("order_id", orderId as any)
        .order("position", { ascending: false })
        .limit(1)
        .single();

      const position = ((maxPos as { position?: number })?.position ?? 0) + 1;
      const { data, error } = await supabase
        .from("checklists")
        .insert({ order_id: orderId, title, position } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists", orderId] });
      setNewChecklistTitle("");
      toast.success("Checklist criada.");
    },
    onError: () => {
      toast.error("Erro ao criar checklist.");
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async ({
      checklistId,
      text,
    }: {
      checklistId: string;
      text: string;
    }) => {
      const { data: maxPos } = await supabase
        .from("checklist_items")
        .select("position")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
.eq("checklist_id", checklistId as any)
        .order("position", { ascending: false })
        .limit(1)
        .single();

      const position = ((maxPos as { position?: number })?.position ?? 0) + 1;
      const { data, error } = await supabase
        .from("checklist_items")
        .insert({ checklist_id: checklistId, text, is_completed: false, position } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["checklists", orderId] });
      setNewItemTexts((prev) => ({ ...prev, [vars.checklistId]: "" }));
      toast.success("Item adicionado.");
    },
    onError: () => {
      toast.error("Erro ao adicionar item.");
    },
  });

  const toggleItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      completed,
    }: {
      itemId: string;
      completed: boolean;
    }) => {
      const { error } = await supabase
        .from("checklist_items")
        .update({ is_completed: completed } as never)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq("id", itemId as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists", orderId] });
    },
  });

  function handleAddChecklist(e: React.FormEvent) {
    e.preventDefault();
    const title = newChecklistTitle.trim();
    if (!title || addChecklistMutation.isPending) return;
    addChecklistMutation.mutate(title);
  }

  function handleAddItem(checklistId: string, e: React.FormEvent) {
    e.preventDefault();
    const text = (newItemTexts[checklistId] ?? "").trim();
    if (!text || addItemMutation.isPending) return;
    addItemMutation.mutate({ checklistId, text });
  }

  if (isLoading) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        Carregando checklists...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {checklists.length === 0 && !newChecklistTitle ? (
        <p className="text-sm text-muted-foreground">
          Nenhum checklist ainda. Crie o primeiro para organizar as tarefas.
        </p>
      ) : (
        <div className="space-y-4">
          {checklists.map((checklist) => {
            const items = checklist.items ?? [];
            const completed = items.filter((i) => i.is_completed).length;
            const total = items.length;
            const progress = total > 0 ? (completed / total) * 100 : 0;

            return (
              <div
                key={checklist.id}
                className="rounded-lg border bg-card p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{checklist.title}</h4>
                  <span className="text-xs text-muted-foreground">
                    {completed}/{total}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="space-y-2">
                  {items.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={item.is_completed}
                        onCheckedChange={(checked) =>
                          toggleItemMutation.mutate({
                            itemId: item.id,
                            completed: !!checked,
                          })
                        }
                        disabled={toggleItemMutation.isPending}
                      />
                      <span
                        className={
                          item.is_completed
                            ? "text-sm text-muted-foreground line-through"
                            : "text-sm"
                        }
                      >
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
                <form
                  onSubmit={(e) => handleAddItem(checklist.id, e)}
                  className="flex gap-2"
                >
                  <Input
                    value={newItemTexts[checklist.id] ?? ""}
                    onChange={(e) =>
                      setNewItemTexts((prev) => ({
                        ...prev,
                        [checklist.id]: e.target.value,
                      }))
                    }
                    placeholder="Novo item..."
                    className="flex-1"
                    disabled={addItemMutation.isPending}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="ghost"
                    disabled={
                      !(newItemTexts[checklist.id] ?? "").trim() ||
                      addItemMutation.isPending
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleAddChecklist} className="flex gap-2">
        <Input
          value={newChecklistTitle}
          onChange={(e) => setNewChecklistTitle(e.target.value)}
          placeholder="Título do novo checklist"
          className="flex-1"
          disabled={addChecklistMutation.isPending}
        />
        <Button
          type="submit"
          size="sm"
          disabled={
            !newChecklistTitle.trim() || addChecklistMutation.isPending
          }
        >
          <ListTodo className="h-4 w-4" />
          Nova checklist
        </Button>
      </form>
    </div>
  );
}
