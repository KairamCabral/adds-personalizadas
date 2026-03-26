"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  getRepGoalsWithActuals,
  createRepGoal,
  updateRepGoal,
  deleteRepGoal,
  type RepGoalWithActual,
} from "@/services/representantes.service";
import { cn } from "@/lib/utils";

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]}/${year}`;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getAchievementConfig(percent: number | null) {
  if (percent === null)
    return { label: "—", color: "text-muted-foreground", dot: "bg-muted-foreground/50" };
  if (percent >= 100)
    return { label: `${percent}%`, color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" };
  if (percent >= 70)
    return { label: `${percent}%`, color: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" };
  return { label: `${percent}%`, color: "text-red-600 dark:text-red-400", dot: "bg-red-500" };
}

function generateMonthOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const value = `${year}-${month}`;
    return { value, label: formatMonth(value) };
  });
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// -------------------------------------------------------
// Inline number cell
// -------------------------------------------------------

interface InlineNumberCellProps {
  value: number;
  onSave: (v: number) => Promise<void>;
  format: "currency" | "number";
}

function InlineNumberCell({ value, onSave, format }: InlineNumberCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    const num = parseFloat(draft.replace(",", "."));
    if (isNaN(num) || num < 0) {
      toast.error("Valor inválido");
      return;
    }
    setLoading(true);
    try {
      await onSave(num);
      setEditing(false);
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className="h-7 w-28 text-sm"
        disabled={loading}
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      title="Clique para editar"
      className="rounded px-1.5 py-0.5 text-sm font-medium hover:bg-secondary/80 transition-colors cursor-text"
    >
      {format === "currency"
        ? formatCurrency(value)
        : value > 0
          ? value
          : <span className="text-muted-foreground">—</span>}
    </button>
  );
}

// -------------------------------------------------------
// Nova Meta Dialog
// -------------------------------------------------------

interface NewGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingMonths: string[];
  repId: string;
}

function NewGoalDialog({ open, onOpenChange, existingMonths, repId }: NewGoalDialogProps) {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(getCurrentMonthKey);
  const [targetValue, setTargetValue] = useState("");
  const [targetOrders, setTargetOrders] = useState("");

  const monthOptions = generateMonthOptions();

  const mutation = useMutation({
    mutationFn: () =>
      createRepGoal(
        repId,
        month,
        parseFloat(targetValue.replace(",", ".")),
        targetOrders ? parseInt(targetOrders) : null
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rep-goals", repId] });
      toast.success("Meta criada com sucesso");
      onOpenChange(false);
      setTargetValue("");
      setTargetOrders("");
      setMonth(getCurrentMonthKey());
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar meta", { description: err.message });
    },
  });

  const handleSubmit = () => {
    const val = parseFloat(targetValue.replace(",", "."));
    if (!targetValue || isNaN(val) || val <= 0) {
      toast.error("Informe um valor de meta válido");
      return;
    }
    if (existingMonths.includes(month)) {
      toast.warning(`Já existe meta para ${formatMonth(month)}. Edite os valores diretamente na tabela.`);
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova meta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mês</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                    {existingMonths.includes(opt.value) && (
                      <span className="ml-2 text-xs text-amber-600">(já existe)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Meta em R$ <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              placeholder="Ex: 20000"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              Meta em pedidos <span className="text-xs">(opcional)</span>
            </label>
            <Input
              type="number"
              placeholder="Ex: 25"
              value={targetOrders}
              onChange={(e) => setTargetOrders(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Criando..." : "Criar meta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------
// Main component
// -------------------------------------------------------

interface TabMetasProps {
  repId: string;
  repName: string;
}

export function TabMetas({ repId, repName }: TabMetasProps) {
  const queryClient = useQueryClient();
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; month: string } | null>(null);

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["rep-goals", repId],
    queryFn: () => getRepGoalsWithActuals(repId),
    staleTime: 2 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: { target_value?: number; target_orders?: number | null };
    }) => updateRepGoal(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rep-goals", repId] });
      toast.success("Meta atualizada");
    },
    onError: () => toast.error("Erro ao atualizar meta"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRepGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rep-goals", repId] });
      toast.success("Meta removida");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Erro ao remover meta"),
  });

  const handleCopyPrevious = async () => {
    if (goals.length === 0) {
      toast.warning("Nenhuma meta anterior para copiar");
      return;
    }
    const currentMonth = getCurrentMonthKey();
    if (goals.some((g: RepGoalWithActual) => g.month === currentMonth)) {
      toast.warning("Já existe meta para o mês atual");
      return;
    }
    const mostRecent = goals[0];
    try {
      await createRepGoal(repId, currentMonth, mostRecent.target_value, mostRecent.target_orders);
      queryClient.invalidateQueries({ queryKey: ["rep-goals", repId] });
      toast.success(
        `Meta de ${formatMonth(mostRecent.month)} copiada para ${formatMonth(currentMonth)}`
      );
    } catch {
      toast.error("Erro ao copiar meta");
    }
  };

  const existingMonths = goals.map((g: RepGoalWithActual) => g.month);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold">Metas de {repName}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyPrevious} disabled={isLoading}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copiar mês anterior
          </Button>
          <Button size="sm" onClick={() => setNewGoalOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nova meta
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : goals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Target className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Nenhuma meta cadastrada</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use &quot;Nova meta&quot; para criar a primeira.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold">Mês</TableHead>
                    <TableHead className="font-semibold">Meta Valor</TableHead>
                    <TableHead className="font-semibold">Meta Pedidos</TableHead>
                    <TableHead className="font-semibold">Vendido</TableHead>
                    <TableHead className="font-semibold">Pedidos</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goals.map((goal: RepGoalWithActual) => {
                    const config = getAchievementConfig(goal.achievement_percent);
                    return (
                      <TableRow key={goal.id}>
                        <TableCell className="font-medium">{formatMonth(goal.month)}</TableCell>
                        <TableCell>
                          <InlineNumberCell
                            value={goal.target_value}
                            format="currency"
                            onSave={(v) =>
                              updateMutation.mutateAsync({
                                id: goal.id,
                                updates: { target_value: v },
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <InlineNumberCell
                            value={goal.target_orders ?? 0}
                            format="number"
                            onSave={(v) =>
                              updateMutation.mutateAsync({
                                id: goal.id,
                                updates: { target_orders: v > 0 ? v : null },
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {formatCurrency(goal.actual_value)}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">{goal.actual_orders}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn("inline-block h-2 w-2 rounded-full shrink-0", config.dot)}
                            />
                            <span className={cn("text-sm font-semibold tabular-nums", config.color)}>
                              {config.label}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget({ id: goal.id, month: goal.month })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <NewGoalDialog
        open={newGoalOpen}
        onOpenChange={setNewGoalOpen}
        existingMonths={existingMonths}
        repId={repId}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remover meta"
        description={`Tem certeza que deseja remover a meta de ${
          deleteTarget ? formatMonth(deleteTarget.month) : ""
        }?`}
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
