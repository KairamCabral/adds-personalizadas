"use client";

import { useEffect } from "react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOrderById, updateOrder } from "@/services/orders.service";
import { getUsers } from "@/services/users.service";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
    }
    // form é estável; incluir nas deps pode causar loop de re-renders (#310)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const updateMutation = useMutation({
    mutationFn: (data: EditOrderFormData) =>
      updateOrder(orderId!, {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        status: data.status as OrderStatus,
        priority: data.priority,
        start_date: data.start_date || null,
        due_date: data.due_date || null,
        assigned_to: data.assigned_to || null,
      }),
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

  function onSubmit(data: EditOrderFormData) {
    updateMutation.mutate(data);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-border px-6 py-4">
          <SheetTitle>Editar pedido</SheetTitle>
          <SheetDescription>
            Altere os dados do pedido e salve as alterações
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
                    className="text-base"
                  />
                  {form.formState.errors.title && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.title.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    placeholder="Observações ou detalhes do pedido"
                    rows={3}
                    className="resize-none text-base"
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
                      {ORDER_STATUSES.map((s) => (
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
                    <Input
                      id="start_date"
                      type="date"
                      {...form.register("start_date")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Data de entrega</Label>
                    <Input
                      id="due_date"
                      type="date"
                      {...form.register("due_date")}
                    />
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
                      {users
                        .filter((u: { is_active: boolean }) => u.is_active)
                        .map((u: { id: string; full_name: string }) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-border px-6 py-4 flex gap-2">
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
