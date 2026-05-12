"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Warehouse, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export interface TinyDeposito {
  id: number;
  name: string;
  notes: string | null;
  is_active: boolean;
}

interface TinyDepositoSelectProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  /** Destaca opções cujo nome contenha esse texto. */
  hint?: string;
  disabled?: boolean;
  /** Quando MASTER, permite adicionar/remover do cadastro inline. */
  canManage?: boolean;
}

export function TinyDepositoSelect({
  value,
  onChange,
  placeholder = "Selecione o depósito do Tiny",
  hint,
  disabled,
  canManage = true,
}: TinyDepositoSelectProps) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const query = useQuery({
    queryKey: ["tiny-depositos-cadastro"],
    queryFn: async (): Promise<TinyDeposito[]> => {
      const res = await fetch("/api/tiny/depositos");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar.");
      return (json.depositos ?? []) as TinyDeposito[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (input: { id: number; name: string; notes?: string }) => {
      const res = await fetch("/api/tiny/depositos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao cadastrar.");
      return json.deposito as TinyDeposito;
    },
    onSuccess: (d) => {
      toast.success(`Depósito "${d.name}" cadastrado.`);
      qc.invalidateQueries({ queryKey: ["tiny-depositos-cadastro"] });
      onChange(d.id);
      setAddOpen(false);
      setNewId("");
      setNewName("");
      setNewNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/tiny/depositos?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao remover.");
    },
    onSuccess: () => {
      toast.success("Depósito removido.");
      qc.invalidateQueries({ queryKey: ["tiny-depositos-cadastro"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const depositos = query.data ?? [];

  // Ordena: sugeridos primeiro
  const sorted = [...depositos].sort((a, b) => {
    if (!hint) return a.name.localeCompare(b.name, "pt-BR");
    const hintLc = hint.toLowerCase();
    const aMatch = a.name.toLowerCase().includes(hintLc) ? 0 : 1;
    const bMatch = b.name.toLowerCase().includes(hintLc) ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  const NONE = "__none__";
  const ADD = "__add__";

  return (
    <>
      <Select
        value={value != null ? String(value) : NONE}
        onValueChange={(v) => {
          if (v === ADD) {
            setAddOpen(true);
            return;
          }
          onChange(v === NONE ? null : parseInt(v, 10));
        }}
        disabled={disabled || query.isLoading}
      >
        <SelectTrigger>
          {query.isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando…
            </span>
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            <span className="text-muted-foreground">Nenhum</span>
          </SelectItem>

          {sorted.length === 0 && !query.isLoading && (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              Nenhum depósito cadastrado ainda.
            </div>
          )}

          {sorted.map((d) => {
            const isSuggested =
              hint && d.name.toLowerCase().includes(hint.toLowerCase());
            return (
              <SelectItem key={d.id} value={String(d.id)}>
                <div className="flex items-center gap-2">
                  <Warehouse
                    className={`h-3.5 w-3.5 ${
                      isSuggested ? "text-[--adds-blue]" : "text-muted-foreground"
                    }`}
                  />
                  <span>{d.name}</span>
                  <span className="text-[10px] text-muted-foreground">#{d.id}</span>
                  {isSuggested && (
                    <span className="text-[10px] font-medium text-[--adds-blue]">
                      sugerido
                    </span>
                  )}
                </div>
              </SelectItem>
            );
          })}

          {canManage && (
            <>
              <SelectSeparator />
              <SelectItem value={ADD} className="text-[--adds-blue]">
                <div className="flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  Cadastrar depósito do Tiny
                </div>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-[--adds-blue]" />
              Cadastrar depósito do Tiny
            </DialogTitle>
            <DialogDescription>
              No Olist, abra <strong>Suprimentos › Configurações › Depósitos
              de estoque</strong>, clique no depósito e copie o ID da URL
              (último número). Informe abaixo o ID + nome para usar em todos
              os produtos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dep-id">ID do depósito no Tiny</Label>
              <Input
                id="dep-id"
                type="number"
                inputMode="numeric"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="ex: 25147"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-name">Nome (como aparece no Olist)</Label>
              <Input
                id="dep-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ex: SP – WS Serviços – Personaliz"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-notes" className="text-xs text-muted-foreground">
                Notas (opcional)
              </Label>
              <Input
                id="dep-notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="ex: depósito de personalizados WS"
              />
            </div>

            {depositos.length > 0 && (
              <details className="rounded border border-border bg-muted/30 p-2">
                <summary className="cursor-pointer text-xs font-medium">
                  Depósitos já cadastrados ({depositos.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {depositos.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded bg-background px-2 py-1.5 text-xs"
                    >
                      <span className="truncate">
                        <span className="text-muted-foreground">#{d.id}</span>{" "}
                        {d.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-destructive"
                        onClick={() => {
                          if (window.confirm(`Remover depósito "${d.name}"?`)) {
                            removeMutation.mutate(d.id);
                          }
                        }}
                        disabled={removeMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const id = parseInt(newId, 10);
                if (!Number.isFinite(id) || id <= 0) {
                  toast.error("Informe um ID numérico válido.");
                  return;
                }
                if (!newName.trim()) {
                  toast.error("Informe o nome.");
                  return;
                }
                createMutation.mutate({
                  id,
                  name: newName.trim(),
                  notes: newNotes.trim() || undefined,
                });
              }}
              disabled={createMutation.isPending}
              className="bg-[--adds-blue] hover:bg-[--adds-blue]/90"
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
