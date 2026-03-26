"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Percent, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/hooks/use-permissions";

interface PendingDiscount {
  id: string;
  order_number: number;
  discount_percentage: number | null;
  is_personalized: boolean | null;
  created_at: string;
  rep_id: string | null;
  client_name: string | null;
  rep_name: string | null;
  products_summary: string;
  total_qty: number;
}

async function fetchPendingDiscounts(repFilter: string): Promise<PendingDiscount[]> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("orders")
    .select(
      `id, order_number, discount_percentage, is_personalized, created_at, rep_id,
       clients(name),
       profiles!orders_rep_id_fkey(full_name),
       order_items(product_name, quantity)`
    )
    .eq("discount_pending_approval", true)
    .order("created_at", { ascending: false });

  if (repFilter !== "all") {
    query = query.eq("rep_id", repFilter);
  }

  const { data, error } = await query;
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((o: any) => {
    const items: { product_name?: string; quantity?: number }[] = o.order_items ?? [];
    const totalQty = items.reduce((sum, i) => sum + (i.quantity ?? 0), 0);
    const firstProduct = items[0]?.product_name ?? "Produtos";
    const productsSummary =
      items.length > 1
        ? `${totalQty} un (${firstProduct} +${items.length - 1})`
        : `${totalQty} un (${firstProduct})`;

    return {
      id: o.id,
      order_number: o.order_number,
      discount_percentage: o.discount_percentage,
      is_personalized: o.is_personalized,
      created_at: o.created_at,
      rep_id: o.rep_id,
      client_name: o.clients?.name ?? null,
      rep_name: o.profiles?.full_name ?? null,
      products_summary: productsSummary,
      total_qty: totalQty,
    };
  });
}

async function fetchRepresentantes(): Promise<{ id: string; full_name: string }[]> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("profiles")
    .select("id, full_name")
    .eq("role", "REPRESENTANTE")
    .order("full_name");
  return data ?? [];
}

async function approveDiscount(orderId: string): Promise<void> {
  const supabase = createClient();

  // Buscar dados do pedido para notificação
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase as any)
    .from("orders")
    .select("rep_id, order_number, discount_percentage")
    .eq("id", orderId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("orders")
    .update({ discount_pending_approval: false })
    .eq("id", orderId);

  if (error) throw error;

  if (order?.rep_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("notifications").insert({
      user_id: order.rep_id,
      type: "desconto_aprovado",
      title: "🟢 Desconto aprovado",
      message: `Desconto de ${order.discount_percentage}% do pedido #${order.order_number} foi aprovado.`,
      data: { order_id: orderId },
    });
  }
}

async function rejectDiscount(orderId: string, reason: string): Promise<void> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase as any)
    .from("orders")
    .select("rep_id, order_number, discount_percentage")
    .eq("id", orderId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("orders")
    .update({
      discount_pending_approval: false,
      discount_percentage: 0,
      notes: `Desconto rejeitado: ${reason}`,
    })
    .eq("id", orderId);

  if (error) throw error;

  if (order?.rep_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("notifications").insert({
      user_id: order.rep_id,
      type: "desconto_rejeitado",
      title: "🔴 Desconto rejeitado",
      message: `Desconto do pedido #${order.order_number} foi rejeitado. Motivo: ${reason}`,
      data: { order_id: orderId, reason },
    });
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DescontosPage() {
  const { can, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();

  const [repFilter, setRepFilter] = useState("all");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: reps = [] } = useQuery({
    queryKey: ["representantes-list-simple"],
    queryFn: fetchRepresentantes,
  });

  const { data: pendingDiscounts = [], isLoading } = useQuery({
    queryKey: ["pending-discounts", repFilter],
    queryFn: () => fetchPendingDiscounts(repFilter),
    enabled: !permissionsLoading && can("representantes.view"),
  });

  const approveMutation = useMutation({
    mutationFn: approveDiscount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-discounts"] });
      toast.success("Desconto aprovado com sucesso");
    },
    onError: () => toast.error("Erro ao aprovar desconto"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      rejectDiscount(orderId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-discounts"] });
      toast.success("Desconto rejeitado");
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: () => toast.error("Erro ao rejeitar desconto"),
  });

  const handleRejectConfirm = () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    rejectMutation.mutate({ orderId: rejectTarget, reason: rejectReason.trim() });
  };

  if (!permissionsLoading && !can("representantes.view")) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Sem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Descontos Pendentes de Aprovação</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Revise e aprove ou rejeite descontos solicitados pelos representantes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={repFilter} onValueChange={setRepFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por rep" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os representantes</SelectItem>
              {reps.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : pendingDiscounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
          <p className="text-base font-medium text-foreground">
            ✅ Nenhum desconto pendente de aprovação
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os descontos foram processados.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pedido</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Representante</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Produtos</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Desconto</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pendingDiscounts.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">#{order.order_number}</span>
                      {order.is_personalized && (
                        <Badge variant="outline" className="text-xs">Personalizado</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.client_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.rep_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.products_summary}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5 text-amber-500" />
                      <span className="font-semibold text-amber-600">
                        {order.discount_percentage ?? 0}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
                        onClick={() => approveMutation.mutate(order.id)}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                        onClick={() => {
                          setRejectTarget(order.id);
                          setRejectReason("");
                        }}
                        disabled={rejectMutation.isPending}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Rejeitar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog de Rejeição */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Rejeitar Desconto
            </DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. O representante será notificado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reject-reason">Motivo da rejeição *</Label>
            <Textarea
              id="reject-reason"
              placeholder="Ex: Desconto acima do permitido para o produto..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setRejectTarget(null); setRejectReason(""); }}
              disabled={rejectMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejeitando..." : "Confirmar Rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
