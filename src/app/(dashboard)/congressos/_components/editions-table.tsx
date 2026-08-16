"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { EventEdition } from "@/types/database.types";
import Link from "next/link";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  QrCode,
  ClipboardList,
  ScanLine,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface EditionsTableProps {
  data: EventEdition[];
  isLoading?: boolean;
  onEdit: (edition: EventEdition) => void;
  onShowLink: (edition: EventEdition) => void;
  onToggleActive: (edition: EventEdition) => void;
  onDelete: (id: string) => void;
}

/** "2026-07-08" -> "08/07/2026" (sem conversão de timezone). */
function fmtDate(d: string | null): string {
  if (!d) return "—";
  const parts = d.slice(0, 10).split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function cashbackSummary(e: EventEdition): string {
  const valor =
    e.cashback_type === "PERCENT"
      ? `${e.cashback_value ?? 0}%`
      : `R$ ${e.cashback_value ?? 0}`;
  const elegiveis = e.cashback_eligibility === "NEW_ONLY" ? "novos" : "todos";
  const validade = e.cashback_valid_days ? `${e.cashback_valid_days}d` : null;
  return [valor, elegiveis, validade].filter(Boolean).join(" • ");
}

export function EditionsTable({
  data,
  isLoading,
  onEdit,
  onShowLink,
  onToggleActive,
  onDelete,
}: EditionsTableProps) {
  const router = useRouter();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const columns: ColumnDef<EventEdition>[] = [
    {
      accessorKey: "name",
      header: "Edição",
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div>
            <p className="font-medium">{e.name}</p>
            <p className="text-xs text-muted-foreground">/{e.slug}</p>
          </div>
        );
      },
    },
    {
      id: "period",
      header: "Período",
      cell: ({ row }) => {
        const e = row.original;
        if (!e.starts_at && !e.ends_at) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <span className="text-muted-foreground">
            {fmtDate(e.starts_at)} – {fmtDate(e.ends_at)}
          </span>
        );
      },
    },
    {
      id: "gift",
      header: "Brinde",
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div>
            <p>{e.gift_name ?? "—"}</p>
            {e.gift_stock != null && (
              <p className="text-xs text-muted-foreground">
                estoque: {e.gift_stock}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "cashback",
      header: "Cashback",
      cell: ({ row }) => {
        const e = row.original;
        if (!e.cashback_enabled) {
          return <span className="text-muted-foreground">—</span>;
        }
        return <Badge variant="secondary">{cashbackSummary(e)}</Badge>;
      },
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) =>
        row.original.is_active ? (
          <Badge>Ativa</Badge>
        ) : (
          <Badge variant="outline">Inativa</Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const e = row.original;
        return (
          <DropdownMenu>
            {/* Impede que o menu e o botão disparem o clique da linha. */}
            <DropdownMenuTrigger asChild onClick={(ev) => ev.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(ev) => ev.stopPropagation()}>
              <DropdownMenuItem asChild>
                <Link href={`/congressos/${e.id}`}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Inscritos & brindes
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/congressos/retirada?edition=${e.id}`}>
                  <ScanLine className="mr-2 h-4 w-4" />
                  Retirada (estande)
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleActive(e)}>
                {e.is_active ? (
                  <>
                    <ToggleLeft className="mr-2 h-4 w-4" />
                    Desativar
                  </>
                ) : (
                  <>
                    <ToggleRight className="mr-2 h-4 w-4 text-primary" />
                    Ativar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(e)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShowLink(e)}>
                <QrCode className="mr-2 h-4 w-4" />
                Link e QR
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteTargetId(e.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
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
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        emptyMessage="Nenhuma edição cadastrada"
        pageSize={20}
        onRowClick={(e) => router.push(`/congressos/${e.id}`)}
      />
      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Excluir edição"
        description="Tem certeza que deseja excluir esta edição? Os pré-cadastros, brindes e créditos vinculados também serão removidos. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={() => {
          if (deleteTargetId) {
            onDelete(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
      />
    </>
  );
}
