"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Cloud,
  Check,
  X,
  AlertTriangle,
  CalendarDays,
  Package,
  Boxes,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  ShoppingBag,
  Download,
  Settings2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader as _PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  currentReferenceMonth,
  type DivergenceStatus,
} from "@/lib/supplier-inventory/divergence";
import { ImportFromTinyDialog } from "./import-from-tiny-dialog";

type Supplier = {
  id: string;
  name: string;
  inventory_config: unknown;
};

type Pool = "PERSONALIZADO" | "MARKETPLACE";

type InventoryHeader = {
  id: string;
  supplier_id: string;
  reference_month: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  notes: string | null;
  rejected_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
};

type InventoryItem = {
  id: string;
  inventory_id: string;
  product_id: string;
  color_key: string | null;
  pool: Pool;
  quantity_declared: number;
  quantity_committed: number;
  quantity_balance: number;
  tiny_quantity: number | null;
  tiny_synced_at: string | null;
  divergence_status: DivergenceStatus | null;
  notes: string | null;
  product: {
    id: string;
    name: string;
    image_url: string | null;
    available_colors: unknown;
    tiny_id: number | null;
    tiny_deposito_personalizado_id?: number | null;
    tiny_deposito_marketplace_id?: number | null;
  } | null;
};

interface InventoryViewProps {
  supplier: Supplier;
  role: "MASTER" | "GESTOR";
}

function formatMonth(referenceMonth: string): string {
  const [y, m] = referenceMonth.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  const formatted = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function statusBadge(status: InventoryHeader["status"]) {
  const map: Record<InventoryHeader["status"], { label: string; cls: string }> = {
    DRAFT: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
    SUBMITTED: {
      label: "Enviado",
      cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    },
    APPROVED: {
      label: "Aprovado",
      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    REJECTED: { label: "Rejeitado", cls: "bg-destructive/15 text-destructive" },
  };
  const s = map[status];
  return <Badge className={s.cls}>{s.label}</Badge>;
}

export function InventoryView({ supplier, role }: InventoryViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [referenceMonth, setReferenceMonth] = useState<string>(currentReferenceMonth());
  const [draftEdits, setDraftEdits] = useState<Record<string, number>>({});
  const [importOpen, setImportOpen] = useState(false);
  const canEdit = role === "MASTER";

  const inventoriesQuery = useQuery({
    queryKey: ["supplier-inventories", supplier.id],
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/${supplier.id}/inventories`);
      if (!res.ok) throw new Error("Falha ao carregar inventários.");
      const json = (await res.json()) as { inventories: InventoryHeader[] };
      return json.inventories;
    },
  });

  const inventories = inventoriesQuery.data ?? [];
  const current = useMemo(
    () => inventories.find((i) => i.reference_month === referenceMonth) ?? null,
    [inventories, referenceMonth]
  );

  const itemsQuery = useQuery({
    queryKey: ["supplier-inventory-items", current?.id],
    queryFn: async () => {
      if (!current) return null;
      const res = await fetch(`/api/suppliers/${supplier.id}/inventories/${current.id}`);
      if (!res.ok) throw new Error("Falha ao carregar itens.");
      const json = (await res.json()) as {
        inventory: InventoryHeader;
        items: InventoryItem[];
      };
      return json;
    },
    enabled: !!current,
  });

  const handleTinyAuthError = (msg: string) => {
    toast.error(msg, {
      action: {
        label: "Reconectar",
        onClick: () => router.push("/settings/integrations"),
      },
    });
  };

  const createMutation = useMutation({
    mutationFn: async (input: { reference_month: string }) => {
      const res = await fetch(`/api/suppliers/${supplier.id}/inventories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Falha ao criar inventário.");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Inventário criado para o mês selecionado.");
      queryClient.invalidateQueries({ queryKey: ["supplier-inventories", supplier.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveItemsMutation = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Sem inventário corrente.");
      const items = Object.entries(draftEdits).map(([id, quantity_declared]) => ({
        id,
        quantity_declared,
      }));
      if (items.length === 0) return;
      const res = await fetch(`/api/suppliers/${supplier.id}/inventories/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Falha ao salvar.");
      }
    },
    onSuccess: () => {
      toast.success("Quantidades salvas.");
      setDraftEdits({});
      queryClient.invalidateQueries({ queryKey: ["supplier-inventory-items", current?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncTinyMutation = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Sem inventário corrente.");
      const res = await fetch(
        `/api/suppliers/${supplier.id}/inventories/${current.id}/sync-tiny`,
        { method: "POST" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = json as { error?: string; code?: string };
        if (err.code === "TINY_RECONNECT") {
          handleTinyAuthError(err.error ?? "Sessão Tiny expirada.");
          throw new Error("TINY_RECONNECT");
        }
        throw new Error(err.error ?? "Falha ao sincronizar com Tiny.");
      }
      return json as { synced: number; errors?: string[] };
    },
    onSuccess: (data) => {
      toast.success(`Tiny sincronizado: ${data.synced} variante(s).`);
      if (data.errors?.length) {
        toast.warning(`${data.errors.length} aviso(s). Verifique o log do servidor.`);
      }
      queryClient.invalidateQueries({ queryKey: ["supplier-inventory-items", current?.id] });
    },
    onError: (e: Error) => {
      if (e.message !== "TINY_RECONNECT") toast.error(e.message);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (input: {
      status: InventoryHeader["status"];
      rejected_reason?: string;
    }) => {
      if (!current) throw new Error("Sem inventário corrente.");
      const res = await fetch(`/api/suppliers/${supplier.id}/inventories/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Falha ao atualizar status.");
      }
    },
    onSuccess: () => {
      toast.success("Status atualizado.");
      queryClient.invalidateQueries({ queryKey: ["supplier-inventories", supplier.id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-inventory-items", current?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = itemsQuery.data?.items ?? [];

  const totals = useMemo(() => {
    const declared = items.reduce((acc, i) => acc + (draftEdits[i.id] ?? i.quantity_declared), 0);
    const committed = items
      .filter((i) => i.pool === "PERSONALIZADO")
      .reduce((acc, i) => acc + i.quantity_committed, 0);
    const balance = declared - committed;
    // Cada linha (pool) tem seu próprio Tiny agora (depósito específico)
    const breaks = items.filter(
      (i) => i.divergence_status === "BREAK" || i.divergence_status === "COMMITTED_GT_DECLARED"
    ).length;
    const diverges = items.filter((i) => i.divergence_status === "DIVERGE").length;
    const matches = items.filter((i) => i.divergence_status === "MATCH").length;
    const missing = items.filter((i) => i.divergence_status === "MISSING_TINY").length;
    const synced = items.filter((i) => i.tiny_quantity != null).length;
    const coverage = items.length > 0 ? Math.round((synced / items.length) * 100) : 0;
    return { declared, committed, balance, breaks, diverges, matches, missing, coverage, totalLines: items.length };
  }, [items, draftEdits]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>([currentReferenceMonth(), referenceMonth]);
    for (const inv of inventories) set.add(inv.reference_month);
    return Array.from(set).sort().reverse();
  }, [inventories, referenceMonth]);

  // Agrupa items por product_id → cor (para a UI agregada)
  const productsByGroup = useMemo(() => groupItems(items), [items]);

  return (
    <>
      {/* Header hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[--adds-blue]/5 via-background to-[--adds-orange]/5 p-6">
        <div className="absolute right-0 top-0 h-32 w-32 -translate-y-1/3 translate-x-1/3 rounded-full bg-[--adds-blue]/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-24 w-24 translate-y-1/3 -translate-x-1/3 rounded-full bg-[--adds-orange]/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Link
              href="/settings/suppliers"
              className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              Fornecedores
            </Link>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-[--adds-blue]/10 p-2">
                <Boxes className="h-5 w-5 text-[--adds-blue]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold leading-tight">
                  {supplier.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Inventário · {formatMonth(referenceMonth)}
                </p>
              </div>
              {current && <div className="ml-2">{statusBadge(current.status)}</div>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-1.5 backdrop-blur">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Select value={referenceMonth} onValueChange={setReferenceMonth}>
                <SelectTrigger className="h-7 w-[170px] border-0 bg-transparent p-0 text-sm shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatMonth(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!current && canEdit && (
              <Button
                onClick={() => createMutation.mutate({ reference_month: referenceMonth })}
                disabled={createMutation.isPending}
                className="bg-[--adds-blue] hover:bg-[--adds-blue]/90"
              >
                {createMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Criar inventário
              </Button>
            )}

            {current && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncTinyMutation.mutate()}
                  disabled={syncTinyMutation.isPending}
                >
                  {syncTinyMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Cloud className="mr-2 h-4 w-4" />
                  )}
                  Sync Tiny
                </Button>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setImportOpen(true)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Importar do Tiny
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    queryClient.invalidateQueries({
                      queryKey: ["supplier-inventory-items", current.id],
                    })
                  }
                  title="Recarregar"
                  className="h-9 w-9"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {current && items.length > 0 && (
          <>
            <Separator className="my-5" />
            <div className="relative grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiHero
                label="Saldo total"
                value={totals.balance.toLocaleString("pt-BR")}
                hint={`${totals.declared.toLocaleString("pt-BR")} declarado − ${totals.committed.toLocaleString("pt-BR")} carteira`}
                icon={<Package className="h-4 w-4" />}
                tone={totals.balance < 0 ? "danger" : "default"}
              />
              <KpiHero
                label="Carteira"
                value={totals.committed.toLocaleString("pt-BR")}
                hint="Pedidos abertos no CRM"
                icon={<ShoppingBag className="h-4 w-4" />}
              />
              <KpiHero
                label="Rupturas"
                value={totals.breaks.toString()}
                hint={
                  totals.breaks > 0
                    ? "Carteira excede estoque"
                    : "Sem quebra de estoque"
                }
                icon={<AlertTriangle className="h-4 w-4" />}
                tone={totals.breaks > 0 ? "danger" : "success"}
              />
              <KpiHero
                label="Cobertura Tiny"
                value={`${totals.coverage}%`}
                hint={`${totals.totalLines - totals.missing} de ${totals.totalLines} linhas`}
                icon={<TrendingUp className="h-4 w-4" />}
                tone={totals.coverage === 100 ? "success" : totals.coverage > 60 ? "default" : "warning"}
                progress={totals.coverage}
              />
            </div>
          </>
        )}
      </div>

      {/* Floating save bar */}
      {current && canEdit && Object.keys(draftEdits).length > 0 && (
        <div className="sticky top-4 z-10 flex items-center justify-between rounded-lg border border-[--adds-blue]/40 bg-[--adds-blue]/5 px-4 py-2.5 shadow-sm backdrop-blur">
          <p className="text-sm">
            <span className="font-semibold">{Object.keys(draftEdits).length}</span>{" "}
            alteração{Object.keys(draftEdits).length > 1 ? "ões" : ""} não salva
            {Object.keys(draftEdits).length > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDraftEdits({})}
            >
              Descartar
            </Button>
            <Button
              size="sm"
              onClick={() => saveItemsMutation.mutate()}
              disabled={saveItemsMutation.isPending}
              className="bg-[--adds-blue] hover:bg-[--adds-blue]/90"
            >
              {saveItemsMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Salvar tudo
            </Button>
          </div>
        </div>
      )}

      {/* Status actions */}
      {current && canEdit && (current.status === "DRAFT" || current.status === "SUBMITTED") && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {current.status === "DRAFT" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => statusMutation.mutate({ status: "SUBMITTED" })}
            >
              Marcar como enviado
            </Button>
          )}
          {current.status === "SUBMITTED" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const reason = window.prompt("Motivo da rejeição:");
                  if (reason) statusMutation.mutate({ status: "REJECTED", rejected_reason: reason });
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Rejeitar
              </Button>
              <Button
                size="sm"
                onClick={() => statusMutation.mutate({ status: "APPROVED" })}
              >
                <Check className="mr-2 h-4 w-4" />
                Aprovar
              </Button>
            </>
          )}
        </div>
      )}

      {/* Body */}
      {!current ? (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          title={`Nenhum inventário criado para ${formatMonth(referenceMonth)}`}
          description={
            canEdit
              ? "Crie o inventário do mês para o fornecedor preencher as quantidades."
              : "Aguarde o MASTER criar o inventário do mês."
          }
        />
      ) : itemsQuery.isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-8 w-8" />}
          title="Inventário vazio"
          description="Nenhum produto está vinculado ao fornecedor. Vincule produtos existentes em Settings › Produtos ou importe do Tiny."
          actions={
            canEdit ? (
              <div className="flex gap-2">
                <Button onClick={() => setImportOpen(true)}>
                  <Download className="mr-2 h-4 w-4" />
                  Importar do Tiny
                </Button>
                <Link href="/settings/products">
                  <Button variant="outline">
                    <Settings2 className="mr-2 h-4 w-4" />
                    Ir para produtos
                  </Button>
                </Link>
              </div>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {productsByGroup.map((g) => (
            <ProductCard
              key={g.productId}
              group={g}
              canEdit={canEdit && current.status === "DRAFT"}
              draftEdits={draftEdits}
              setDraftEdits={setDraftEdits}
            />
          ))}
        </div>
      )}

      <ImportFromTinyDialog
        supplierId={supplier.id}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ["supplier-inventory-items", current?.id] });
          if (current) {
            createMutation.mutate({ reference_month: current.reference_month });
          }
        }}
      />
    </>
  );
}

// ─── KPI Hero ──────────────────────────────────────────────────────────

function KpiHero({
  label,
  value,
  hint,
  icon,
  tone,
  progress,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  progress?: number;
}) {
  const toneCls = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-destructive",
  }[tone ?? "default"];
  const iconBg = {
    default: "bg-muted text-muted-foreground",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    danger: "bg-destructive/15 text-destructive",
  }[tone ?? "default"];

  return (
    <div className="rounded-xl border border-border bg-background/80 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className={`rounded-md p-1.5 ${iconBg}`}>{icon}</div>
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      {progress != null && (
        <Progress value={progress} className="mt-2 h-1.5" />
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
      <div className="rounded-full bg-background p-3 text-muted-foreground">
        {icon}
      </div>
      <div className="max-w-sm space-y-1">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actions}
    </div>
  );
}

// ─── Agrupamento ───────────────────────────────────────────────────────

type ColorGroup = {
  colorKey: string | null;
  colorLabel: string;
  colorHex: string | null;
  items: InventoryItem[]; // 1 ou 2 (PERSONALIZADO e/ou MARKETPLACE)
};

type ProductGroup = {
  productId: string;
  productName: string;
  productImage: string | null;
  colors: ColorGroup[];
  pools: Set<Pool>;
};

function groupItems(items: InventoryItem[]): ProductGroup[] {
  const byProduct = new Map<string, ProductGroup>();

  for (const it of items) {
    if (!byProduct.has(it.product_id)) {
      byProduct.set(it.product_id, {
        productId: it.product_id,
        productName: it.product?.name ?? "Sem produto",
        productImage: it.product?.image_url ?? null,
        colors: [],
        pools: new Set(),
      });
    }
    const product = byProduct.get(it.product_id)!;
    product.pools.add(it.pool);

    let color = product.colors.find(
      (c) => (c.colorKey ?? "") === (it.color_key ?? "")
    );
    if (!color) {
      const colorList = Array.isArray(it.product?.available_colors)
        ? (it.product?.available_colors as Array<{
            key: string;
            label?: string;
            hex?: string;
          }>)
        : [];
      const meta = colorList.find((c) => c.key === it.color_key);
      color = {
        colorKey: it.color_key,
        colorLabel: meta?.label ?? it.color_key ?? "—",
        colorHex: meta?.hex ?? null,
        items: [],
      };
      product.colors.push(color);
    }
    color.items.push(it);
  }

  return Array.from(byProduct.values()).sort((a, b) =>
    a.productName.localeCompare(b.productName, "pt-BR")
  );
}

// ─── Product card ──────────────────────────────────────────────────────

function ProductCard({
  group,
  canEdit,
  draftEdits,
  setDraftEdits,
}: {
  group: ProductGroup;
  canEdit: boolean;
  draftEdits: Record<string, number>;
  setDraftEdits: (v: Record<string, number>) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const productTotals = useMemo(() => {
    let declared = 0;
    let committed = 0;
    let tiny = 0;
    let hasTiny = false;
    let hasBreak = false;
    let hasDiverge = false;
    for (const c of group.colors) {
      for (const it of c.items) {
        const d = draftEdits[it.id] ?? it.quantity_declared;
        declared += d;
        if (it.pool === "PERSONALIZADO") committed += it.quantity_committed;
        if (
          it.divergence_status === "BREAK" ||
          it.divergence_status === "COMMITTED_GT_DECLARED"
        )
          hasBreak = true;
        if (it.divergence_status === "DIVERGE") hasDiverge = true;
      }
      // Cada pool tem seu próprio tiny_quantity (depósito específico).
      // Soma todos os tiny das linhas que têm valor.
      for (const it of c.items) {
        if (it.tiny_quantity != null) {
          tiny += it.tiny_quantity;
          hasTiny = true;
        }
      }
    }
    return {
      declared,
      committed,
      balance: declared - committed,
      tiny: hasTiny ? tiny : null,
      hasBreak,
      hasDiverge,
    };
  }, [group.colors, draftEdits]);

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-card ${
        productTotals.hasBreak ? "border-destructive/40" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/40"
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {group.productImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.productImage}
              alt={group.productName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Package className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{group.productName}</h3>
            {productTotals.hasBreak && (
              <Badge className="gap-1 bg-destructive/15 text-destructive">
                <AlertTriangle className="h-3 w-3" />
                Ruptura
              </Badge>
            )}
            {!productTotals.hasBreak && productTotals.hasDiverge && (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Divergência
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{group.colors.length} cor(es)</span>
            <span>·</span>
            {group.pools.has("PERSONALIZADO") && (
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-[--adds-blue]" />
                Personalizados
              </span>
            )}
            {group.pools.has("MARKETPLACE") && (
              <span className="inline-flex items-center gap-1">
                <ShoppingBag className="h-3 w-3 text-[--adds-orange]" />
                Marketplace
              </span>
            )}
          </div>
        </div>
        <div className="hidden text-right md:block">
          <div className="flex items-baseline gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Declarado
              </p>
              <p className="font-medium tabular-nums">
                {productTotals.declared.toLocaleString("pt-BR")}
              </p>
            </div>
            {group.pools.has("PERSONALIZADO") && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Carteira
                </p>
                <p className="font-medium tabular-nums text-muted-foreground">
                  {productTotals.committed.toLocaleString("pt-BR")}
                </p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Tiny
              </p>
              <p className="font-medium tabular-nums text-muted-foreground">
                {productTotals.tiny == null
                  ? "—"
                  : productTotals.tiny.toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/20">
          {group.colors.map((color) => (
            <ColorBlock
              key={color.colorKey ?? "__none__"}
              color={color}
              canEdit={canEdit}
              draftEdits={draftEdits}
              setDraftEdits={setDraftEdits}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Color block (por produto, mostra os pools dentro) ────────────────

function ColorBlock({
  color,
  canEdit,
  draftEdits,
  setDraftEdits,
}: {
  color: ColorGroup;
  canEdit: boolean;
  draftEdits: Record<string, number>;
  setDraftEdits: (v: Record<string, number>) => void;
}) {
  // PERSONALIZADO primeiro
  const sortedItems = [...color.items].sort((a, b) =>
    a.pool === "PERSONALIZADO" ? -1 : b.pool === "PERSONALIZADO" ? 1 : 0
  );

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-3 px-4 pb-1 pt-3">
        {color.colorKey && (
          <div
            className="h-6 w-6 shrink-0 rounded-full border border-border shadow-sm"
            style={{ backgroundColor: color.colorHex ?? "#9ca3af" }}
            title={color.colorLabel}
          />
        )}
        <h4 className="text-sm font-medium">{color.colorLabel}</h4>
      </div>

      <div className="bg-background/50">
        {sortedItems.map((item) => (
          <PoolRow
            key={item.id}
            item={item}
            canEdit={canEdit}
            draftEdits={draftEdits}
            setDraftEdits={setDraftEdits}
          />
        ))}
      </div>
    </div>
  );
}

function LineDivergenceBadge({ status }: { status: DivergenceStatus | null }) {
  if (status === "BREAK" || status === "COMMITTED_GT_DECLARED") {
    return (
      <Badge className="gap-1 bg-destructive/15 text-destructive">
        <AlertTriangle className="h-3 w-3" />
        Ruptura
      </Badge>
    );
  }
  if (status === "DIVERGE") {
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        Divergência
      </Badge>
    );
  }
  if (status === "MISSING_TINY") {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Sem Tiny
      </Badge>
    );
  }
  if (status === "MATCH") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        OK
      </Badge>
    );
  }
  return null;
}

// ─── Pool row (Personalizado ou Marketplace de uma cor) ────────────────

function PoolRow({
  item,
  canEdit,
  draftEdits,
  setDraftEdits,
}: {
  item: InventoryItem;
  canEdit: boolean;
  draftEdits: Record<string, number>;
  setDraftEdits: (v: Record<string, number>) => void;
}) {
  const draft = draftEdits[item.id];
  const declared = draft !== undefined ? draft : item.quantity_declared;
  const isDraft = draft !== undefined;
  const isBreak =
    item.divergence_status === "BREAK" ||
    item.divergence_status === "COMMITTED_GT_DECLARED";
  const balance = declared - item.quantity_committed;
  const tiny = item.tiny_quantity;
  const deltaPct =
    tiny != null && declared > 0 ? ((tiny - declared) / declared) * 100 : null;

  const Icon = item.pool === "PERSONALIZADO" ? Sparkles : ShoppingBag;
  const iconCls =
    item.pool === "PERSONALIZADO" ? "text-[--adds-blue]" : "text-[--adds-orange]";
  const label = item.pool === "PERSONALIZADO" ? "Personalizado" : "Marketplace";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 text-sm ${
        isBreak ? "bg-destructive/5" : ""
      }`}
    >
      <span className="flex w-32 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${iconCls}`} />
        {label}
      </span>

      <div className="flex flex-1 items-center justify-end gap-4">
        <Metric
          label="Declarado"
          value={
            canEdit ? (
              <Input
                type="number"
                min={0}
                value={declared}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  const next = { ...draftEdits };
                  if (Number.isFinite(v) && v !== item.quantity_declared) {
                    next[item.id] = v;
                  } else {
                    delete next[item.id];
                  }
                  setDraftEdits(next);
                }}
                className={`h-8 w-24 text-right tabular-nums ${
                  isDraft ? "border-[--adds-blue] ring-1 ring-[--adds-blue]/20" : ""
                }`}
              />
            ) : (
              declared.toLocaleString("pt-BR")
            )
          }
        />

        {item.pool === "PERSONALIZADO" && (
          <>
            <Metric
              label="Carteira"
              value={item.quantity_committed.toLocaleString("pt-BR")}
              muted
            />
            <Metric
              label="Saldo"
              value={balance.toLocaleString("pt-BR")}
              bold
              accent={balance < 0 ? "danger" : "default"}
            />
          </>
        )}

        <Metric
          label="Tiny"
          value={tiny == null ? "—" : tiny.toLocaleString("pt-BR")}
          muted
        />

        <Metric
          label="Δ%"
          value={
            deltaPct == null
              ? "—"
              : `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%`
          }
          accent={
            deltaPct == null
              ? "default"
              : Math.abs(deltaPct) > 10
                ? "warning"
                : "default"
          }
        />

        <div className="min-w-[88px] text-right">
          <LineDivergenceBadge status={item.divergence_status} />
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  muted,
  bold,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  bold?: boolean;
  accent?: "default" | "danger" | "warning";
}) {
  const cls = [
    "tabular-nums text-sm",
    muted ? "text-muted-foreground" : "",
    bold ? "font-semibold" : "",
    accent === "danger" ? "text-destructive" : "",
    accent === "warning" ? "text-amber-600 dark:text-amber-400" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className={cls}>{value}</div>
    </div>
  );
}
