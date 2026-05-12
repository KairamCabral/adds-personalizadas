// @ts-nocheck
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Pencil, Trash2, Settings2, Boxes } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { ProductIntegrationsDialog } from "./_components/product-integrations-dialog";
import { ProductInventoryDialog } from "./_components/product-inventory-dialog";
import type { Product } from "@/types/database.types";
import type { Json } from "@/types/database.types";
import { toast } from "sonner";

interface ColorEntry {
  key: string;
  label: string;
  hex?: string | null;
}

interface ColorMapping {
  tiny_id?: number | null;
  sku?: string | null;
}

function parseColors(raw: Json | null): ColorEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw as ColorEntry[];
}

function parseTinyColorMap(raw: Json | null): Record<string, ColorMapping> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, ColorMapping>;
}

function getProductSyncStatus(product: Product) {
  const colors = parseColors(product.available_colors);
  const colorMap = parseTinyColorMap(product.tiny_color_map);

  if (colors.length === 0) {
    return product.tiny_id
      ? { label: "✅ Vinculado", variant: "default" as const, count: null }
      : { label: "❌ Pendente", variant: "destructive" as const, count: null };
  }

  const mapped = colors.filter((c) => colorMap[c.key]?.tiny_id || colorMap[c.key]?.sku).length;
  const total = colors.length;

  if (mapped === total) {
    return { label: `✅ ${mapped}/${total}`, variant: "default" as const, count: { mapped, total } };
  }
  if (mapped > 0) {
    return { label: `🟡 ${mapped}/${total}`, variant: "secondary" as const, count: { mapped, total } };
  }
  return { label: `❌ 0/${total}`, variant: "destructive" as const, count: { mapped: 0, total } };
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcMargin(price: number | null, cost: number | null): number | null {
  if (!price || !cost || price === 0) return null;
  return Math.round(((price - cost) / price) * 100);
}

function MarginBadge({ price, cost }: { price: number | null; cost: number | null }) {
  const margin = calcMargin(price, cost);
  if (margin == null) return <span className="text-muted-foreground text-sm">—</span>;

  const cls =
    margin >= 50
      ? "text-green-700 dark:text-green-400 font-semibold"
      : margin >= 30
      ? "text-yellow-700 dark:text-yellow-400 font-semibold"
      : "text-red-700 dark:text-red-400 font-semibold";

  return <span className={cls}>{margin}%</span>;
}

export default function SettingsProductsPage() {
  const router = useRouter();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const hasPermission = can("products.manage");
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [integrationsProduct, setIntegrationsProduct] = useState<Product | null>(null);
  const [inventoryProduct, setInventoryProduct] = useState<Product | null>(null);

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
        header: "Produto",
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue("name")}</span>
        ),
      },
      {
        accessorKey: "price",
        header: "Preço",
        cell: ({ row }) => {
          const price = row.getValue("price") as number | null;
          return (
            <span className="text-sm">{formatCurrency(price)}</span>
          );
        },
      },
      {
        id: "cost",
        header: "Custo",
        cell: ({ row }) => {
          const cost = row.original.cost_price;
          return <span className="text-sm">{formatCurrency(cost)}</span>;
        },
      },
      {
        id: "margin",
        header: "Margem",
        cell: ({ row }) => (
          <MarginBadge price={row.original.price} cost={row.original.cost_price} />
        ),
      },
      {
        id: "tiny_status",
        header: "Tiny",
        cell: ({ row }) => {
          const status = getProductSyncStatus(row.original);
          return (
            <Badge variant={status.variant} className="text-xs whitespace-nowrap">
              {status.label}
            </Badge>
          );
        },
      },
      {
        id: "stock",
        header: "Estoque",
        cell: ({ row }) => {
          const stock = row.original.tiny_stock;
          return (
            <span className="text-sm">
              {stock != null ? stock.toLocaleString("pt-BR") : "—"}
            </span>
          );
        },
      },
      {
        id: "supplier",
        header: "Fornecedor",
        cell: ({ row }) => {
          const name = row.original.supplier_name;
          return (
            <span className="text-sm text-muted-foreground">
              {name ?? "—"}
            </span>
          );
        },
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
                  onClick={() => setIntegrationsProduct(product)}
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Integrações
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setInventoryProduct(product)}
                >
                  <Boxes className="mr-2 h-4 w-4" />
                  Inventário
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
    <div className="min-w-0 space-y-6 p-6">
      <PageHeader
        title="Produtos"
        description="Gerencie o catálogo de produtos e integrações"
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
            print_area_image_url: data.print_area_image_url || null,
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

      {integrationsProduct && (
        <ProductIntegrationsDialog
          open={!!integrationsProduct}
          onOpenChange={(open) => {
            if (!open) setIntegrationsProduct(null);
          }}
          product={integrationsProduct}
          onSaved={(updated) => {
            // Atualiza o produto em exibição no dialog imediatamente
            setIntegrationsProduct((prev) => prev ? { ...prev, ...updated } : prev);
            // Recarrega a lista em background
            queryClient.invalidateQueries({ queryKey: ["products"] });
          }}
        />
      )}

      <ProductInventoryDialog
        product={inventoryProduct}
        onClose={() => setInventoryProduct(null)}
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
