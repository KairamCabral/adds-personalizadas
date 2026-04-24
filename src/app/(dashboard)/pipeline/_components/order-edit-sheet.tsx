"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOrderById, updateOrder, replaceOrderItems } from "@/services/orders.service";
import { getUsers } from "@/services/users.service";
import { getActiveProducts } from "@/services/products.service";
import { ORDER_STATUS_DROPDOWN, type OrderStatus } from "@/lib/constants";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/database.types";
import type { ColorOption } from "./color-picker";

// ─────────────────────────────────────────────
// Tipos locais
// ─────────────────────────────────────────────

/** Quantidade por chave de cor: { lilas: 4, amarelo: 4 } */
type ColorQuantities = Record<string, number>;

interface EditItem {
  product_id: string;
  product_name: string;
  product: Product;
  colorQuantities: ColorQuantities;
}

// ─────────────────────────────────────────────
// Schema do formulário de metadados
// ─────────────────────────────────────────────

const editOrderSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  status: z.string().min(1, "Status é obrigatório"),
  priority: z.enum(["NORMAL", "ALTA"]),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
});

type EditOrderFormData = z.infer<typeof editOrderSchema>;

// ─────────────────────────────────────────────
// Helpers de conversão DB ↔ estado local
// ─────────────────────────────────────────────

interface RawOrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  personalization: {
    colors?: string[];
    custom_color?: string | null;
  } | null;
  product?: {
    id: string;
    name: string;
    image_url?: string | null;
    available_colors?: unknown;
    allows_custom_color?: boolean;
  } | null;
}

/**
 * Cada linha do banco = 1 produto × 1 cor (personalization.colors[0]).
 * Agrupa por product_id acumulando colorQuantities.
 */
function dbItemsToEditItems(rawItems: RawOrderItem[]): EditItem[] {
  const map = new Map<string, EditItem>();

  for (const raw of rawItems) {
    const pid = raw.product_id ?? raw.product_name;
    // Uma linha = exatamente uma cor
    const colorKey = raw.personalization?.colors?.[0] ?? "sem_cor";

    if (!map.has(pid)) {
      const product = raw.product
        ? (raw.product as unknown as Product)
        : ({
            id: raw.product_id ?? "",
            name: raw.product_name,
            image_url: null,
            available_colors: null,
            allows_custom_color: false,
          } as unknown as Product);

      map.set(pid, {
        product_id: pid,
        product_name: raw.product_name,
        product,
        colorQuantities: { [colorKey]: raw.quantity },
      });
    } else {
      const existing = map.get(pid)!;
      existing.colorQuantities[colorKey] =
        (existing.colorQuantities[colorKey] ?? 0) + raw.quantity;
    }
  }

  return Array.from(map.values());
}

/**
 * Converte estado local → formato do banco (uma linha por cor, igual a expandItemsToApiFormat).
 */
function editItemsToDbParams(items: EditItem[]) {
  return items.flatMap((item) =>
    Object.entries(item.colorQuantities)
      .filter(([, qty]) => qty >= 1)
      .map(([colorKey, qty]) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: qty,
        personalization: {
          colors: [colorKey],
          custom_color: null,
        },
      }))
  );
}

function parseColors(product: Product): ColorOption[] {
  const raw = (product as unknown as { available_colors?: unknown }).available_colors;
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as ColorOption[]).filter(
    (c) => c && typeof c.key === "string" && typeof c.label === "string"
  );
}

// ─────────────────────────────────────────────
// Sub-componente: editor de um produto
// ─────────────────────────────────────────────

function ProductEditRow({
  item,
  onChange,
  onRemove,
}: {
  item: EditItem;
  onChange: (colorQuantities: ColorQuantities) => void;
  onRemove: () => void;
}) {
  const colors = parseColors(item.product);
  const total = Object.values(item.colorQuantities).reduce((a, b) => a + b, 0);

  const setQty = (key: string, qty: number) => {
    const val = Math.max(0, Math.min(9999, qty));
    const next = { ...item.colorQuantities };
    if (val === 0) {
      delete next[key];
    } else {
      next[key] = val;
    }
    onChange(next);
  };

  const addColor = (key: string) => {
    onChange({ ...item.colorQuantities, [key]: 1 });
  };

  const imageUrl = (item.product as unknown as { image_url?: string | null }).image_url ?? null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Cabeçalho do produto */}
      <div className="flex items-center gap-3 px-4 py-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-base font-semibold text-muted-foreground">
            {item.product_name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{item.product_name}</p>
          <p className="text-xs text-muted-foreground">
            {total > 0
              ? `${total} unidade${total !== 1 ? "s" : ""} no total`
              : "Nenhuma unidade selecionada"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remover produto"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Cores e quantidades */}
      <div className="border-t border-border bg-muted/20 px-4 py-3">
        {colors.length === 0 ? (
          /* Sem cores cadastradas: campo único de quantidade */
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Quantidade</span>
            <QtyControl
              value={item.colorQuantities["sem_cor"] ?? 0}
              onChange={(v) => setQty("sem_cor", v)}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cor e quantidade
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {colors.map((color) => {
                const qty = item.colorQuantities[color.key] ?? 0;
                const selected = qty > 0;
                return (
                  <div
                    key={color.key}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                      selected
                        ? "border-primary/30 bg-primary/5"
                        : "border-border bg-background"
                    )}
                  >
                    {/* Swatch */}
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10"
                      style={color.hex ? { backgroundColor: color.hex } : undefined}
                    />
                    {/* Nome da cor */}
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        selected ? "font-medium text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {color.label}
                    </span>
                    {/* Controle de quantidade ou botão de adicionar */}
                    {selected ? (
                      <QtyControl
                        value={qty}
                        onChange={(v) => setQty(color.key, v)}
                        allowZero
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => addColor(color.key)}
                        className="flex h-6 items-center gap-1 rounded-md border border-dashed border-border px-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                      >
                        <Plus className="h-3 w-3" />
                        Adicionar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Controle +/- de quantidade inline */
function QtyControl({
  value,
  onChange,
  allowZero = false,
}: {
  value: number;
  onChange: (v: number) => void;
  allowZero?: boolean;
}) {
  const min = allowZero ? 0 : 1;
  return (
    <div className="flex items-center rounded-lg border border-border bg-background">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
        aria-label="Diminuir"
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="number"
        min={min}
        max={9999}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(Math.max(min, Math.min(9999, n)));
        }}
        onBlur={(e) => {
          const n = parseInt(e.target.value, 10);
          if (isNaN(n) || n < min) onChange(min);
        }}
        className="h-7 w-10 border-0 bg-transparent text-center text-sm font-semibold text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(9999, value + 1))}
        className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
        aria-label="Aumentar"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

interface OrderEditSheetProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderEditSheet({
  orderId,
  open,
  onOpenChange,
}: OrderEditSheetProps) {
  const queryClient = useQueryClient();
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [items, setItems] = useState<EditItem[]>([]);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrderById(orderId!),
    enabled: !!orderId && open,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    enabled: open,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", "active"],
    queryFn: getActiveProducts,
    enabled: open,
  });

  const form = useForm<EditOrderFormData>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "FAZER",
      priority: "NORMAL",
      start_date: "",
      due_date: "",
      assigned_to: "",
    },
  });

  useEffect(() => {
    if (order) {
      form.reset({
        title: order.title ?? "",
        description: order.description ?? "",
        status: order.status ?? "FAZER",
        priority: order.priority ?? "NORMAL",
        start_date: order.start_date ?? "",
        due_date: order.due_date ?? "",
        assigned_to: order.assigned_to ?? "",
      });
      const rawItems = (order.items ?? []) as unknown as RawOrderItem[];
      setItems(dbItemsToEditItems(rawItems));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const updateMutation = useMutation({
    mutationFn: async (data: EditOrderFormData) => {
      await updateOrder(orderId!, {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        status: data.status as OrderStatus,
        priority: data.priority,
        start_date: data.start_date || null,
        due_date: data.due_date || null,
        assigned_to: data.assigned_to || null,
      });
      await replaceOrderItems(orderId!, editItemsToDbParams(items));
    },
    onSuccess: () => {
      toast.success("Pedido atualizado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Erro ao atualizar pedido.");
    },
  });

  // ── Manipuladores de itens ──
  const addProduct = (product: Product) => {
    const colors = parseColors(product);
    const firstKey = colors.length > 0 ? colors[0].key : "sem_cor";
    setItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        product,
        colorQuantities: { [firstKey]: 1 },
      },
    ]);
    setProductPopoverOpen(false);
  };

  const updateItem = (index: number, colorQuantities: ColorQuantities) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], colorQuantities };
      return next;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const availableToAdd = (products as Product[]).filter(
    (p) => !items.some((i) => i.product_id === p.id)
  );

  const totalUnits = items.reduce(
    (sum, item) =>
      sum + Object.values(item.colorQuantities).reduce((a, b) => a + b, 0),
    0
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <SheetHeader className="shrink-0 border-b border-border px-6 py-4">
          <SheetTitle>Editar pedido</SheetTitle>
          <SheetDescription>
            Altere os dados e os produtos do pedido
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <Tabs defaultValue="products" className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="mx-6 mt-4 shrink-0 grid w-[calc(100%-3rem)] grid-cols-2">
              <TabsTrigger value="products">
                Produtos
                {items.length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary">
                    {items.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="details">Detalhes</TabsTrigger>
            </TabsList>

            {/* ── Aba Produtos ── */}
            <TabsContent
              value="products"
              className="flex-1 overflow-y-auto px-6 py-4 space-y-3 mt-0"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Resumo de unidades */}
                  {totalUnits > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2.5">
                      <span className="text-sm text-muted-foreground">Total geral</span>
                      <span className="text-sm font-semibold text-foreground">
                        {totalUnits} unidade{totalUnits !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}

                  {items.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum produto adicionado ainda.
                    </p>
                  )}

                  {items.map((item, index) => (
                    <ProductEditRow
                      key={item.product_id}
                      item={item}
                      onChange={(colorQuantities) => updateItem(index, colorQuantities)}
                      onRemove={() => removeItem(index)}
                    />
                  ))}

                  {/* Botão adicionar produto */}
                  <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-center border-dashed py-5 text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar produto
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar produto..." />
                        <CommandList>
                          <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                          <CommandGroup>
                            {availableToAdd.map((p) => (
                              <CommandItem key={p.id} onSelect={() => addProduct(p)}>
                                {p.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </TabsContent>

            {/* ── Aba Detalhes ── */}
            <TabsContent
              value="details"
              className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-0"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      {...form.register("title")}
                      placeholder="Ex: Pedido João Silva"
                    />
                    {form.formState.errors.title && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.title.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição / Personalização</Label>
                    <Textarea
                      id="description"
                      {...form.register("description")}
                      placeholder="Observações ou detalhes do pedido"
                      rows={4}
                      className="resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={form.watch("status")}
                      onValueChange={(v) => form.setValue("status", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUS_DROPDOWN.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select
                      value={form.watch("priority")}
                      onValueChange={(v) =>
                        form.setValue("priority", v as "NORMAL" | "ALTA")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="ALTA">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Data de início</Label>
                      <Input id="start_date" type="date" {...form.register("start_date")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="due_date">Data de entrega</Label>
                      <Input id="due_date" type="date" {...form.register("due_date")} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Responsável</Label>
                    <Select
                      value={form.watch("assigned_to") || "none"}
                      onValueChange={(v) =>
                        form.setValue("assigned_to", v === "none" ? "" : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {(
                          users as {
                            id: string;
                            full_name: string;
                            is_active: boolean;
                          }[]
                        )
                          .filter((u) => u.is_active)
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.full_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          {/* Footer fixo */}
          <div className="shrink-0 border-t border-border px-6 py-4 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar alterações"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
