"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  MoreHorizontal,
  Lock,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useLabelTypes } from "@/hooks/use-label-types";
import {
  updateLabelType,
  deleteLabelType,
  type LabelTypeRow,
} from "@/services/labels.service";
import { LabelFormDialog } from "./_components/label-form-dialog";

export default function SettingsLabelsPage() {
  const { can } = usePermissions();
  const canManage = can("labels.manage");
  const queryClient = useQueryClient();
  const { data: labels = [] } = useLabelTypes();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LabelTypeRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LabelTypeRow | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["order_label_types"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const toggleActive = useMutation({
    mutationFn: (row: LabelTypeRow) =>
      updateLabelType(row.slug, { is_active: !row.is_active }),
    onSuccess: (_d, row) => {
      toast.success(row.is_active ? "Etiqueta desativada." : "Etiqueta ativada.");
      invalidate();
    },
    onError: () => toast.error("Erro ao atualizar a etiqueta."),
  });

  const del = useMutation({
    mutationFn: (row: LabelTypeRow) => deleteLabelType(row),
    onSuccess: () => {
      toast.success("Etiqueta excluída.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (row: LabelTypeRow) => {
    setEditing(row);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Etiquetas"
        description="Etiquetas disponíveis para os pedidos no pipeline."
      >
        {canManage && (
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nova etiqueta
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Tipos de etiqueta</CardTitle>
          <CardDescription>
            {labels.length} etiqueta{labels.length === 1 ? "" : "s"}. Crie, edite
            ou desative — os filtros e o seletor do pipeline se atualizam
            automaticamente. Etiquetas do sistema{" "}
            <Lock className="inline h-3 w-3" /> não podem ser excluídas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {labels.map((row) => (
              <div
                key={row.slug}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-4",
                  !row.is_active && "opacity-55"
                )}
              >
                <div
                  className="h-8 w-8 shrink-0 rounded-md"
                  style={{ backgroundColor: row.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-medium">{row.name}</p>
                    {row.is_system && (
                      <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                    {!row.is_active && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        Inativa
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.slug}
                  </p>
                </div>
                <span
                  style={{ backgroundColor: row.color, color: row.text_color }}
                  className="hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex"
                >
                  {row.name}
                </span>

                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Ações</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(row)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => toggleActive.mutate(row)}
                        disabled={toggleActive.isPending}
                      >
                        {row.is_active ? (
                          <>
                            <EyeOff className="mr-2 h-4 w-4" />
                            Desativar
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-4 w-4" />
                            Ativar
                          </>
                        )}
                      </DropdownMenuItem>
                      {!row.is_system && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <LabelFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir etiqueta"
        description={`A etiqueta "${deleteTarget?.name ?? ""}" será removida. Se estiver aplicada em algum pedido, a exclusão é bloqueada — use "Desativar". Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) del.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
