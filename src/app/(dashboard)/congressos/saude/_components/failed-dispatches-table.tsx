"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import type { FailedDispatch } from "@/services/congressos-queue-health.service";

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

async function resend(id: string): Promise<{ sent: number; dead: number }> {
  const res = await fetch(`/api/congressos/dispatches/${id}/resend`, {
    method: "POST",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? "Falha ao reenviar a confirmação.");
  }
  return { sent: body?.sent ?? 0, dead: body?.dead ?? 0 };
}

export function FailedDispatchesTable({
  dispatches,
}: {
  dispatches: FailedDispatch[];
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: resend,
    onSuccess: (r) => {
      if (r.sent > 0) toast.success("Confirmação reenviada.");
      else if (r.dead > 0)
        toast.warning("Reenvio tentado, mas falhou de novo.");
      else toast.success("Reenvio recolocado na fila.");
      queryClient.invalidateQueries({ queryKey: ["congress_queue_health"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = useMemo<ColumnDef<FailedDispatch>[]>(
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
        id: "recipient",
        header: "Destinatário",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="min-w-0">
              <p className="truncate text-sm">{r.recipient ?? "—"}</p>
              <Badge variant="outline" className="mt-0.5 text-[10px]">
                {r.channel}
              </Badge>
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
        header: "Erro",
        cell: ({ row }) => (
          <p
            className="max-w-[320px] truncate text-sm text-destructive"
            title={row.original.send_error ?? undefined}
          >
            {row.original.send_error ?? "—"}
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
            <Send className="mr-2 h-3.5 w-3.5" />
            Reenviar
          </Button>
        ),
      },
    ],
    [mutation]
  );

  return (
    <DataTable
      columns={columns}
      data={dispatches}
      emptyMessage="Nenhum e-mail de confirmação falho."
      pageSize={10}
    />
  );
}
