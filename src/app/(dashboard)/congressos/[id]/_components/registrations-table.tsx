"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
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
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { cn } from "@/lib/utils";
import type { RegistrationWithGift } from "@/services/congressos-gifts.service";

// ---- labels / formatação ----

const CONTACT_LABELS: Record<string, string> = {
  DENTISTA: "Dentista",
  DISTRIBUIDORA: "Distribuidora",
  VAREJISTA: "Varejista",
  CONSUMIDOR: "Consumidor",
};

function contactLabel(ct: string | null): string {
  if (!ct) return "—";
  return CONTACT_LABELS[ct] ?? ct;
}

function giftLabel(status: string | null): string {
  switch (status) {
    case "PENDENTE":
      return "Pendente";
    case "RETIRADO":
      return "Retirado";
    case "CANCELADO":
      return "Cancelado";
    default:
      return "Sem brinde";
  }
}

function syncLabel(status: string | null): string {
  switch (status) {
    case "DONE":
      return "Sincronizado";
    case "PENDING":
    case "PROCESSING":
      return "Na fila";
    case "FAILED":
      return "Falhou";
    case "DEAD":
      return "Erro";
    default:
      return "—";
  }
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

// ---- badges ----

const AMBER =
  "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
const EMERALD =
  "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";

function GiftBadge({ status }: { status: string | null }) {
  if (status == null)
    return <span className="text-muted-foreground">—</span>;
  if (status === "RETIRADO")
    return (
      <Badge variant="outline" className={cn("whitespace-nowrap", EMERALD)}>
        Retirado
      </Badge>
    );
  if (status === "CANCELADO")
    return (
      <Badge variant="outline" className="whitespace-nowrap text-destructive">
        Cancelado
      </Badge>
    );
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", AMBER)}>
      Pendente
    </Badge>
  );
}

function SyncBadge({ status }: { status: string | null }) {
  if (status === "DONE")
    return (
      <Badge variant="outline" className={cn("whitespace-nowrap", EMERALD)}>
        Sincronizado
      </Badge>
    );
  if (status === "FAILED" || status === "DEAD")
    return (
      <Badge variant="outline" className={cn("whitespace-nowrap", AMBER)}>
        {syncLabel(status)}
      </Badge>
    );
  if (status === "PENDING" || status === "PROCESSING")
    return (
      <Badge variant="secondary" className="whitespace-nowrap">
        Na fila
      </Badge>
    );
  return <span className="text-muted-foreground">—</span>;
}

// ---- CSV ----

function csvCell(v: string): string {
  const s = String(v ?? "");
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows: RegistrationWithGift[], editionName: string) {
  const headers = [
    "Nome",
    "Documento",
    "E-mail",
    "Telefone",
    "Contato",
    "Qualificado",
    "Sync Tiny",
    "Brinde",
    "Código",
    "Retirado em",
    "Cadastro",
  ];
  const lines = rows.map((r) => [
    r.name ?? "",
    r.document ?? "",
    r.email ?? "",
    r.phone ?? "",
    contactLabel(r.contact_type),
    r.qualified ? "Sim" : "Não",
    syncLabel(r.sync_status),
    giftLabel(r.gift_status),
    r.short_code ?? "",
    fmtDateTime(r.redeemed_at),
    fmtDateTime(r.created_at),
  ]);
  const csv = [headers, ...lines]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n");
  // BOM (﻿) + separador ";" → abre bem no Excel pt-BR.
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const slug = editionName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const a = document.createElement("a");
  a.href = url;
  a.download = `inscritos-${slug || "congresso"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- componente ----

interface RegistrationsTableProps {
  registrations: RegistrationWithGift[];
  editionName: string;
  isLoading?: boolean;
}

export function RegistrationsTable({
  registrations,
  editionName,
  isLoading,
}: RegistrationsTableProps) {
  const [search, setSearch] = useState("");
  const [giftFilter, setGiftFilter] = useState("all");
  const [qualifiedFilter, setQualifiedFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return registrations.filter((r) => {
      if (giftFilter === "none" && r.gift_status != null) return false;
      if (
        giftFilter !== "all" &&
        giftFilter !== "none" &&
        r.gift_status !== giftFilter
      )
        return false;
      if (qualifiedFilter === "yes" && !r.qualified) return false;
      if (qualifiedFilter === "no" && r.qualified) return false;
      if (!q) return true;
      const name = (r.name ?? "").toLowerCase();
      const email = (r.email ?? "").toLowerCase();
      const doc = r.document ?? "";
      const code = r.short_code ?? "";
      return (
        name.includes(q) ||
        email.includes(q) ||
        (qDigits.length > 0 && doc.includes(qDigits)) ||
        (qDigits.length > 0 && code.includes(qDigits))
      );
    });
  }, [registrations, search, giftFilter, qualifiedFilter]);

  const columns: ColumnDef<RegistrationWithGift>[] = [
    {
      accessorKey: "name",
      header: "Participante",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="min-w-0">
            <p className="font-medium">{r.name ?? "—"}</p>
            {r.email && (
              <p className="truncate text-xs text-muted-foreground">
                {r.email}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "document",
      header: "Documento",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatDoc(row.original.document)}
        </span>
      ),
    },
    {
      id: "contact",
      header: "Contato",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <span>{contactLabel(r.contact_type)}</span>
            {r.qualified && (
              <Badge
                variant="outline"
                className={cn("h-5 px-1.5 text-[10px]", EMERALD)}
              >
                Qualificado
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "sync",
      header: "Tiny",
      cell: ({ row }) => <SyncBadge status={row.original.sync_status} />,
    },
    {
      id: "gift",
      header: "Brinde",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex flex-col gap-0.5">
            <GiftBadge status={r.gift_status} />
            {r.short_code && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {r.short_code}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "redeemed",
      header: "Retirada",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {fmtDateTime(row.original.redeemed_at)}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Nome, CPF, e-mail ou código"
            className="w-full sm:max-w-xs"
          />
          <Select value={giftFilter} onValueChange={setGiftFilter}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue placeholder="Brinde" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os brindes</SelectItem>
              <SelectItem value="PENDENTE">Pendentes</SelectItem>
              <SelectItem value="RETIRADO">Retirados</SelectItem>
              <SelectItem value="CANCELADO">Cancelados</SelectItem>
              <SelectItem value="none">Sem brinde</SelectItem>
            </SelectContent>
          </Select>
          <Select value={qualifiedFilter} onValueChange={setQualifiedFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Qualificação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="yes">Só qualificados</SelectItem>
              <SelectItem value="no">Não qualificados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => exportCsv(filtered, editionName)}
          disabled={filtered.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage="Nenhum inscrito encontrado"
        pageSize={25}
      />
    </div>
  );
}
