"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  assignFollowupToMe,
  getNpsFollowups,
  updateFollowup,
  type FollowupItem,
  type NpsFollowupStatus,
} from "@/services/nps-admin.service";

const STATUS_FILTERS: { value: NpsFollowupStatus | "ALL"; label: string }[] = [
  { value: "ABERTO", label: "Abertos" },
  { value: "EM_TRATATIVA", label: "Em tratativa" },
  { value: "RESOLVIDO", label: "Resolvidos" },
  { value: "DISPENSADO", label: "Dispensados" },
  { value: "ALL", label: "Todos" },
];

const STATUS_BADGE: Record<NpsFollowupStatus, { label: string; className: string }> = {
  ABERTO: { label: "Aberto", className: "bg-[#e2574c]/10 text-[#e2574c]" },
  EM_TRATATIVA: { label: "Em tratativa", className: "bg-[#f5a623]/10 text-[#f5a623]" },
  RESOLVIDO: { label: "Resolvido", className: "bg-[#2ecc71]/10 text-[#2ecc71]" },
  DISPENSADO: { label: "Dispensado", className: "bg-muted text-muted-foreground" },
};

export function NpsFollowupsSection() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<NpsFollowupStatus | "ALL">("ABERTO");
  const [resolveTarget, setResolveTarget] = useState<FollowupItem | null>(null);
  const [note, setNote] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["nps", "followups", filter],
    queryFn: () => getNpsFollowups(filter === "ALL" ? undefined : filter),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["nps", "followups"] });

  const assignMutation = useMutation({
    mutationFn: (id: string) => assignFollowupToMe(id),
    onSuccess: () => {
      toast.success("Tratativa atribuída a você.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atribuir."),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: NpsFollowupStatus }) =>
      updateFollowup(id, status, note.trim() || undefined),
    onSuccess: () => {
      toast.success("Tratativa atualizada.");
      setResolveTarget(null);
      setNote("");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar."),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma tratativa nesta visão. 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const badge = STATUS_BADGE[item.status];
            return (
              <Card key={item.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#0b4269]">
                        {item.clientName ?? "Cliente"}
                      </span>
                      <span className="text-sm font-bold text-[#e2574c]">Nota {item.score ?? "?"}</span>
                      <Badge variant="secondary" className={badge.className}>
                        {badge.label}
                      </Badge>
                    </div>
                    {item.comment ? (
                      <p className="text-sm text-muted-foreground">“{item.comment}”</p>
                    ) : (
                      <p className="text-sm italic text-muted-foreground/70">Sem comentário</p>
                    )}
                    {item.resolution_note && (
                      <p className="text-xs text-muted-foreground">
                        Tratativa: {item.resolution_note}
                      </p>
                    )}
                  </div>
                  {(item.status === "ABERTO" || item.status === "EM_TRATATIVA") && (
                    <div className="flex shrink-0 gap-2">
                      {item.status === "ABERTO" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={assignMutation.isPending}
                          onClick={() => assignMutation.mutate(item.id)}
                        >
                          Assumir
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="bg-[#21add6] text-white hover:bg-[#1c97bb]"
                        onClick={() => {
                          setResolveTarget(item);
                          setNote("");
                        }}
                      >
                        Resolver
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!resolveTarget} onOpenChange={(o) => !o && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver tratativa</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {resolveTarget?.clientName ?? "Cliente"} — nota {resolveTarget?.score ?? "?"}
          </p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Descreva como a situação foi tratada (opcional)…"
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={resolveMutation.isPending}
              onClick={() =>
                resolveTarget &&
                resolveMutation.mutate({ id: resolveTarget.id, status: "DISPENSADO" })
              }
            >
              Dispensar
            </Button>
            <Button
              className="bg-[#2ecc71] text-white hover:bg-[#27b362]"
              disabled={resolveMutation.isPending}
              onClick={() =>
                resolveTarget &&
                resolveMutation.mutate({ id: resolveTarget.id, status: "RESOLVIDO" })
              }
            >
              {resolveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
                </>
              ) : (
                "Marcar como resolvido"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
