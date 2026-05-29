"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getVolumeDiscounts,
  createVolumeDiscount,
  updateVolumeDiscount,
  deleteVolumeDiscount,
  type PricingVolumeDiscount,
} from "@/services/pricing.service";
import type { VolumeDiscountFormData } from "@/lib/validations";
import { VolumeDiscountDialog } from "./volume-discount-dialog";

const CHANNEL_LABELS: Record<string, string> = {
  CONSUMIDOR: "Consumidor",
  DENTISTA: "Dentista",
  DISTRIBUIDORA: "Distribuidora",
  VAREJISTA: "Varejista",
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function VolumeDiscountsSection() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PricingVolumeDiscount | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ["pricing-volume-discounts"],
    queryFn: getVolumeDiscounts,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["pricing-volume-discounts"] });

  const createMutation = useMutation({
    mutationFn: createVolumeDiscount,
    onSuccess: () => {
      toast.success("Desconto criado com sucesso.");
      invalidate();
      setFormOpen(false);
    },
    onError: () => toast.error("Erro ao criar desconto."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: VolumeDiscountFormData }) =>
      updateVolumeDiscount(id, data),
    onSuccess: () => {
      toast.success("Desconto atualizado com sucesso.");
      invalidate();
      setFormOpen(false);
      setEditing(null);
    },
    onError: () => toast.error("Erro ao atualizar desconto."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVolumeDiscount,
    onSuccess: () => {
      toast.success("Desconto excluído com sucesso.");
      invalidate();
      setDeleteTargetId(null);
    },
    onError: () => toast.error("Erro ao excluir desconto."),
  });

  const columns: ColumnDef<PricingVolumeDiscount>[] = useMemo(
    () => [
      {
        accessorKey: "channel",
        header: "Canal",
        cell: ({ row }) => (
          <span className="font-medium">
            {CHANNEL_LABELS[row.original.channel] ?? row.original.channel}
          </span>
        ),
      },
      {
        accessorKey: "min_order_value",
        header: "Valor mínimo do pedido",
        cell: ({ row }) => (
          <span className="text-sm">
            {formatCurrency(Number(row.original.min_order_value))}
          </span>
        ),
      },
      {
        accessorKey: "discount_pct",
        header: "Desconto",
        cell: ({ row }) => (
          <span className="text-sm font-semibold">
            {Number(row.original.discount_pct)}%
          </span>
        ),
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? "default" : "secondary"}>
            {row.original.is_active ? "Ativo" : "Inativo"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const discount = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Abrir menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditing(discount);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteTargetId(discount.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo desconto
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Carregando descontos...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={discounts}
          emptyMessage="Nenhum desconto por volume cadastrado"
        />
      )}

      <VolumeDiscountDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        initialData={editing}
        onSubmit={(data) => {
          if (editing) {
            updateMutation.mutate({ id: editing.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Excluir desconto"
        description="Tem certeza que deseja excluir este desconto por volume? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={() => {
          if (deleteTargetId) deleteMutation.mutate(deleteTargetId);
        }}
      />
    </div>
  );
}
