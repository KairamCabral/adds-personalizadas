"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import type { DeadSyncJob } from "@/services/congressos-queue-health.service";

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function requeueJob(id: string): Promise<{ done: number; dead: number }> {
  const res = await fetch(`/api/congressos/sync-jobs/${id}/requeue`, {
    method: "POST",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? "Falha ao reprocessar o job.");
  }
  return { done: body?.done ?? 0, dead: body?.dead ?? 0 };
}

export function DeadJobsTable({ jobs }: { jobs: DeadSyncJob[] }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: requeueJob,
    onSuccess: (r) => {
      if (r.done > 0) toast.success("Job reprocessado e sincronizado.");
      else if (r.dead > 0)
        toast.warning("Reprocessado, mas falhou de novo — segue morto.");
      else toast.success("Job recolocado na fila para nova tentativa.");
      queryClient.invalidateQueries({ queryKey: ["congress_queue_health"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = useMemo<ColumnDef<DeadSyncJob>[]>(
    () => [
      {
        id: "participant",
        header: "Participante",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="min-w-0">
              <p className="font-medium">{r.participant_name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {r.edition_name ?? "—"}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "attempts",
        header: "Tentativas",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.attempts}</span>
        ),
      },
      {
        id: "error",
        header: "Último erro",
        cell: ({ row }) => (
          <p
            className="max-w-[380px] truncate text-sm text-destructive"
            title={row.original.last_error ?? undefined}
          >
            {row.original.last_error ?? "—"}
          </p>
        ),
      },
      {
        id: "when",
        header: "Quando",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {fmtDateTime(row.original.updated_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            disabled={
              mutation.isPending && mutation.variables === row.original.id
            }
            onClick={() => mutation.mutate(row.original.id)}
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Reprocessar
          </Button>
        ),
      },
    ],
    [mutation]
  );

  return (
    <DataTable
      columns={columns}
      data={jobs}
      emptyMessage="Nenhum job de sync morto."
      pageSize={10}
    />
  );
}
