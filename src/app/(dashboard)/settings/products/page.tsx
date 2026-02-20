// @ts-nocheck
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/services/products.service";
import { ProductFormDialog } from "./_components/product-form-dialog";
import type { Product } from "@/types/database.types";
import { toast } from "sonner";

export default function SettingsProductsPage() {
  const router = useRouter();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const hasPermission = can("products.manage");
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
    enabled: !permissionsLoading && hasPermission,
  });

  useEffect(() => {
    if (!permissionsLoading && !hasPermission) {
      router.replace("/pipeline");
    }
  }, [permissionsLoading, hasPermission, router]);

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      toast.success("Produto criado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setFormOpen(false);
    },
    onError: () => toast.error("Erro ao criar produto."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      updateProduct(id, data),
    onSuccess: () => {
      toast.success("Produto atualizado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setFormOpen(false);
      setEditingProduct(null);
    },
    onError: () => toast.error("Erro ao atualizar produto."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      toast.success("Produto excluído com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeleteTargetId(null);
    },
    onError: () => toast.error("Erro ao excluir produto."),
  });

  const columns: ColumnDef<Product>[] = useMemo(() => {
    const cols: ColumnDef<Product>[] = [
      {
        accessorKey: "image_url",
        header: "Imagem",
        cell: ({ row }) => {
          const url = row.getValue("image_url") as string | null;
          return url ? (
            <img
              src={url}
              alt=""
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          );
        },
      },
      {
        accessorKey: "name",
        header: "Nome",
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue("name")}</span>
        ),
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => {
          const active = row.getValue("is_active") as boolean;
          return (
            <Badge variant={active ? "default" : "secondary"}>
              {active ? "Ativo" : "Inativo"}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const product = row.original;
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
                    setEditingProduct(product);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteTargetId(product.id)}
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
    return cols;
  }, []);

  if (permissionsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Produtos"
        description="Gerencie o catálogo de produtos"
        children={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Button>
        }
      />

      {isLoading ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Carregando produtos...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={products}
          emptyMessage="Nenhum produto cadastrado"
        />
      )}

      <ProductFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingProduct(null);
        }}
        initialData={editingProduct ?? undefined}
        onSubmit={(data) => {
          const payload = {
            name: data.name,
            description: data.description || null,
            image_url: data.image_url || null,
            available_colors: data.available_colors ?? [],
            allows_custom_color: false,
            is_active: data.is_active ?? true,
          };
          if (editingProduct) {
            updateMutation.mutate({ id: editingProduct.id, data: payload });
          } else {
            createMutation.mutate(payload);
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Excluir produto"
        description="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={() => {
          if (deleteTargetId) {
            deleteMutation.mutate(deleteTargetId);
          }
        }}
      />
    </div>
  );
}
