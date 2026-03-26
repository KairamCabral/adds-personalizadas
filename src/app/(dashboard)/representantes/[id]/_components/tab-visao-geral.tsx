"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, X, TrendingUp, ShoppingBag, MapPin, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import type { RepresentanteDetail, RepresentanteKpis } from "@/services/representantes.service";
import { updateRepresentanteExtras } from "@/services/representantes.service";

interface TabVisaoGeralProps {
  rep: RepresentanteDetail;
  kpis: RepresentanteKpis | undefined;
  kpisLoading: boolean;
  repId: string;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function GoalProgress({
  value,
  meta,
  label,
}: {
  value: number;
  meta: number;
  label: string;
}) {
  const percent = meta > 0 ? Math.round((value / meta) * 100) : null;
  const color =
    percent === null
      ? "text-muted-foreground"
      : percent >= 100
        ? "text-emerald-600"
        : percent >= 60
          ? "text-amber-600"
          : "text-red-600";

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-muted-foreground">
        Meta: {label}
      </p>
      {percent !== null ? (
        <>
          <div className="flex items-center gap-2">
            <Progress value={Math.min(percent, 100)} className="h-1.5 flex-1" />
            <span className={cn("text-xs font-semibold tabular-nums", color)}>
              {percent}%
            </span>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Sem meta definida</p>
      )}
    </div>
  );
}

interface InlineEditProps {
  label: string;
  value: string;
  placeholder: string;
  onSave: (value: string) => Promise<void>;
  type?: string;
  canEdit?: boolean;
}

function InlineEdit({ label, value, placeholder, onSave, type = "text", canEdit = false }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(draft);
      toast.success("Salvo");
      setEditing(false);
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing && canEdit) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-40 shrink-0">{label}:</span>
        <div className="flex items-center gap-1.5">
          <Input
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-7 w-48 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleSave}
            disabled={loading}
          >
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleCancel}
            disabled={loading}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <span className="text-sm text-muted-foreground w-40 shrink-0">{label}:</span>
      <span className="text-sm font-medium">
        {value || <span className="text-muted-foreground italic">{placeholder}</span>}
      </span>
      {canEdit && (
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}

export function TabVisaoGeral({ rep, kpis, kpisLoading, repId }: TabVisaoGeralProps) {
  const queryClient = useQueryClient();
  const { isMaster, isGestor } = usePermissions();
  const canEdit = isMaster || isGestor;

  const mutation = useMutation({
    mutationFn: (extras: { tiny_seller_id?: string | null; commission_rate?: number | null }) =>
      updateRepresentanteExtras(repId, extras),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["representante", repId] });
      toast.success("Informações salvas com sucesso");
    },
    onError: () => {
      toast.error("Erro ao salvar informações");
    },
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Vendido */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vendido no mês
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(kpis?.vendidoMes ?? 0)}
                </div>
                <GoalProgress
                  value={kpis?.vendidoMes ?? 0}
                  meta={kpis?.metaVendas ?? 0}
                  label={kpis?.metaVendas ? formatCurrency(kpis.metaVendas) : "—"}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Pedidos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pedidos no mês
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.pedidosMes ?? 0}</div>
                <GoalProgress
                  value={kpis?.pedidosMes ?? 0}
                  meta={kpis?.metaPedidos ?? 0}
                  label={kpis?.metaPedidos ? String(kpis.metaPedidos) : "—"}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Visitas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Visitas no mês
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{kpis?.visitasMes ?? 0}</div>
            )}
          </CardContent>
        </Card>

        {/* Conversão */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conversão
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {kpis?.conversaoPercent !== null && kpis?.conversaoPercent !== undefined
                    ? `${kpis.conversaoPercent}%`
                    : "—"}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">vis → venda</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Carteira */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carteira</CardTitle>
        </CardHeader>
        <CardContent>
          {kpisLoading ? (
            <div className="flex gap-6">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-40" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span>
                <span className="font-semibold">{kpis?.clientesAtivos ?? 0}</span>{" "}
                <span className="text-muted-foreground">clientes ativos</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span>
                <span className="font-semibold">{kpis?.clientesVisitados ?? 0}</span>{" "}
                <span className="text-muted-foreground">
                  visitados no mês
                  {kpis?.clientesAtivos
                    ? ` (${Math.round(((kpis?.clientesVisitados ?? 0) / kpis.clientesAtivos) * 100)}%)`
                    : ""}
                </span>
              </span>
              {(kpis?.clientesPerdendoVinculo ?? 0) > 0 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-amber-600">
                    <span className="font-semibold">{kpis?.clientesPerdendoVinculo}</span>{" "}
                    perdendo vínculo
                  </span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-40 shrink-0">Email:</span>
            <span className="text-sm font-medium">{rep.email}</span>
          </div>

          {kpisLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-64" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-40 shrink-0">Território:</span>
              <span className="text-sm font-medium">
                {kpis?.territories.length
                  ? kpis.territories.map((t) => t.city).join(", ")
                  : <span className="text-muted-foreground italic">Nenhuma cidade atribuída</span>}
              </span>
            </div>
          )}

          <InlineEdit
            label="ID Vendedor Tiny"
            value={rep.tiny_seller_id ?? ""}
            placeholder="Não configurado"
            canEdit={canEdit}
            onSave={(v) =>
              mutation.mutateAsync({ tiny_seller_id: v || null })
            }
          />

          <InlineEdit
            label="Taxa de comissão (%)"
            value={rep.commission_rate !== null ? String(rep.commission_rate) : ""}
            placeholder="Não configurada"
            type="number"
            canEdit={canEdit}
            onSave={(v) =>
              mutation.mutateAsync({
                commission_rate: v ? parseFloat(v) : null,
              })
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
