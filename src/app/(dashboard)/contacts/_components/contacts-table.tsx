"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { maskPhone, getInitials, generateAvatarColor } from "@/lib/utils";
import type { Client } from "@/types/database.types";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface ContactsTableProps {
  data: Client[];
  isLoading?: boolean;
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  total?: number;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function ContactsTable({
  data,
  isLoading,
  onEdit,
  onDelete,
  total = 0,
  page = 1,
  totalPages = 1,
  onPageChange,
}: ContactsTableProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const columns: ColumnDef<Client>[] = [
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => {
        const client = row.original;
        return (
          <Link
            href={`/contacts/${client.id}`}
            className="flex items-center gap-3 hover:underline"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={client.logo_url ?? undefined} />
              <AvatarFallback
                className={`${generateAvatarColor(client.name)} text-white`}
              >
                {getInitials(client.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{client.name}</p>
              {client.company && (
                <p className="text-xs text-muted-foreground">{client.company}</p>
              )}
            </div>
          </Link>
        );
      },
    },
    {
      accessorKey: "person_type",
      header: "Tipo",
      cell: ({ row }) => {
        const type = row.getValue("person_type") as string;
        return (
          <Badge
            variant={type === "JURIDICA" ? "secondary" : "outline"}
          >
            {type === "FISICA" ? "Pessoa Física" : "Pessoa Jurídica"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "email",
      header: "E-mail",
      cell: ({ row }) => {
        const email = row.getValue("email") as string | null;
        return <span className="text-muted-foreground">{email ?? "—"}</span>;
      },
    },
    {
      accessorKey: "phone",
      header: "Telefone",
      cell: ({ row }) => {
        const phone = row.getValue("phone") as string | null;
        return (
          <span className="text-muted-foreground">
            {phone ? maskPhone(phone) : "—"}
          </span>
        );
      },
    },
    {
      id: "location",
      header: "Cidade/Estado",
      cell: ({ row }) => {
        const client = row.original;
        const parts = [client.city, client.state].filter(Boolean);
        return (
          <span className="text-muted-foreground">
            {parts.length ? parts.join(" / ") : "—"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const client = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/contacts/${client.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalhes
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(client)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteTargetId(client.id)}
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
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Nome", "Tipo", "E-mail", "Telefone", "Cidade/Estado", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-5 w-20 rounded-full" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-36" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-24" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-8 w-8 rounded-md" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const showServerPagination =
    onPageChange && totalPages > 1 && total > 0;

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        emptyMessage="Nenhum contato encontrado"
        pageSize={50}
        hidePagination={showServerPagination}
      />
      {showServerPagination && (
        <div className="flex items-center justify-between px-2 py-4">
          <p className="text-sm text-muted-foreground">
            {total} registro(s) no total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Próxima
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Excluir contato"
        description="Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita."
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
