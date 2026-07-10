"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical, Check, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  getEditionCredits,
  updateCreditStatus,
  type EditionCredit,
} from "@/services/congressos-credits.service";
import {
  formatCashbackValue,
  effectiveCreditStatus,
  creditStatusLabel,
} from "@/lib/congressos/cashback-format";

const STATUS_CLASS: Record<string, string> = {
  ATIVO:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  EXPIRADO:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  CANCELADO: "text-destructive",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function formatDoc(doc: string | null): string {
  if (!doc) return "—";
  const d = doc.replace(/\D/g, "");
  if (d.length === 11)
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(
      8,
      12
    )}-${d.slice(12)}`;
  return doc;
}

function KpiPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-2.5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function CreditsTable({ editionId }: { editionId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirm, setConfirm] = useState<{
    id: string;
    status: "USADO" | "CANCELADO";
  } | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const { data: credits = [], isLoading } = useQuery({
    queryKey: ["edition_credits", editionId],
    queryFn: () => getEditionCredits(editionId),
  });

  const mutation = useMutation({
    mutationFn: (v: { id: string; status: "USADO" | "CANCELADO" }) =>
      updateCreditStatus(v.id, { status: v.status }),
    onSuccess: (_d, v) => {
      toast.success(
        v.status === "USADO"
          ? "Crédito marcado como usado."
          : "Crédito cancelado."
      );
      queryClient.invalidateQueries({
        queryKey: ["edition_credits", editionId],
      });
    },
    onError: () => toast.error("Erro ao atualizar o crédito."),
  });

  const rows = useMemo(
    () =>
      credits.map((c) => ({
        ...c,
        _status: effectiveCreditStatus(c.status, c.valid_until, today),
      })),
    [credits, today]
  );

  const kpis = useMemo(() => {
    const acc = { ATIVO: 0, USADO: 0, EXPIRADO: 0, CANCELADO: 0 };
    for (const r of rows) acc[r._status] += 1;
    return acc;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return rows.filter((r) => {
      if (statusFilter !== "all" && r._status !== statusFilter) return false;
      if (!q) return true;
      const name = (r.participant_name ?? "").toLowerCase();
      const doc = r.document ?? "";
      return name.includes(q) || (qDigits.length > 0 && doc.includes(qDigits));
    });
  }, [rows, search, statusFilter]);

  type Row = (typeof rows)[number];

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "participant_name",
      header: "Participante",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="min-w-0">
            <p className="font-medium">{r.participant_name ?? "—"}</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {formatDoc(r.document)}
            </p>
          </div>
        );
      },
    },
    {
      id: "value",
      header: "Cashback",
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCashbackValue(row.original.type, row.original.value)}
        </span>
      ),
    },
    {
      id: "valid",
      header: "Validade",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {fmtDate(row.original.valid_until)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const st = row.original._status;
        return (
          <Badge
            variant={st === "USADO" ? "secondary" : "outline"}
            className={cn("whitespace-nowrap", STATUS_CLASS[st])}
          >
            {creditStatusLabel(st)}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const r = row.original;
        if (r._status !== "ATIVO")
          return <span className="text-muted-foreground">—</span>;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Ações</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setConfirm({ id: r.id, status: "USADO" })}
              >
                <Check className="mr-2 h-4 w-4" />
                Marcar como usado
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirm({ id: r.id, status: "CANCELADO" })}
              >
                <Ban className="mr-2 h-4 w-4" />
                Cancelar crédito
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiPill label="Ativos" value={kpis.ATIVO} />
        <KpiPill label="Usados" value={kpis.USADO} />
        <KpiPill label="Expirados" value={kpis.EXPIRADO} />
        <KpiPill label="Cancelados" value={kpis.CANCELADO} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Nome ou CPF"
          className="w-full sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ATIVO">Ativos</SelectItem>
            <SelectItem value="USADO">Usados</SelectItem>
            <SelectItem value="EXPIRADO">Expirados</SelectItem>
            <SelectItem value="CANCELADO">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="Nenhum crédito de cashback nesta edição"
        pageSize={25}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm?.status === "USADO"
            ? "Marcar crédito como usado"
            : "Cancelar crédito"
        }
        description={
          confirm?.status === "USADO"
            ? "Confirma que o cliente já usou este cashback? Registra a data de uso."
            : "O crédito será cancelado e não poderá mais ser usado."
        }
        confirmLabel={
          confirm?.status === "USADO" ? "Marcar usado" : "Cancelar crédito"
        }
        cancelLabel="Voltar"
        variant={confirm?.status === "CANCELADO" ? "destructive" : "default"}
        onConfirm={() => {
          if (confirm) mutation.mutate(confirm);
          setConfirm(null);
        }}
      />
    </div>
  );
}
