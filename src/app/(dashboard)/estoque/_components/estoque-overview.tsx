"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Package,
  Settings2,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currentReferenceMonth } from "@/lib/supplier-inventory/divergence";

type Status = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
type Pool = "PERSONALIZADO" | "MARKETPLACE";

type Overview = {
  reference_month: string;
  totals: {
    declared: number;
    committed: number;
    balance: number;
    breaks: number;
    diverges: number;
    matches: number;
    missing: number;
    items_count: number;
    colors_count: number;
    coverage_pct: number;
  };
  suppliers: Array<{
    id: string;
    name: string;
    inventory_id: string | null;
    inventory_status: Status | null;
    items_count: number;
    colors_count: number;
    declared: number;
    committed: number;
    balance: number;
    breaks: number;
    diverges: number;
    coverage_pct: number;
  }>;
  critical_products: Array<{
    item_id: string;
    product_id: string;
    product_name: string;
    product_image: string | null;
    color_key: string | null;
    color_label: string | null;
    pool: Pool;
    declared: number;
    committed: number;
    balance: number;
    divergence_status: string | null;
    supplier_id: string | null;
    supplier_name: string | null;
  }>;
  unconfigured: {
    count: number;
    samples: Array<{ id: string; name: string; image_url: string | null }>;
  };
  pending_inventories: Array<{
    id: string;
    supplier_id: string;
    supplier_name: string | null;
    reference_month: string;
    status: Status;
  }>;
};

function formatMonth(referenceMonth: string): string {
  const [y, m] = referenceMonth.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  const formatted = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function buildMonthOptions(currentMonth: string, fromOverview?: string[]): string[] {
  const set = new Set<string>([currentReferenceMonth(), currentMonth]);
  // últimos 12 meses
  const [y, m] = currentReferenceMonth().split("-").map((s) => parseInt(s, 10));
  for (let i = 1; i <= 11; i++) {
    const d = new Date(y, m - 1 - i, 1);
    set.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
    );
  }
  if (fromOverview) for (const m of fromOverview) set.add(m);
  return Array.from(set).sort().reverse();
}

function statusBadge(status: Status | null) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Sem inventário
      </Badge>
    );
  }
  const map: Record<Status, { label: string; cls: string }> = {
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

interface EstoqueOverviewProps {
  role: "MASTER" | "GESTOR";
}

export function EstoqueOverview({ role }: EstoqueOverviewProps) {
  const [month, setMonth] = useState<string>(currentReferenceMonth());

  const overviewQuery = useQuery({
    queryKey: ["inventory-overview", month],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/overview?month=${month}`);
      if (!res.ok) throw new Error("Falha ao carregar visão geral.");
      return (await res.json()) as Overview;
    },
  });

  const overview = overviewQuery.data;
  const monthOptions = useMemo(() => buildMonthOptions(month), [month]);

  const hasAlerts =
    !!overview &&
    (overview.totals.breaks > 0 ||
      overview.unconfigured.count > 0 ||
      overview.pending_inventories.length > 0);

  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[--adds-blue]/5 via-background to-[--adds-orange]/5 p-6">
        <div className="absolute right-0 top-0 h-32 w-32 -translate-y-1/3 translate-x-1/3 rounded-full bg-[--adds-blue]/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-24 w-24 translate-y-1/3 -translate-x-1/3 rounded-full bg-[--adds-orange]/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[--adds-blue]/10 p-2.5">
              <Warehouse className="h-6 w-6 text-[--adds-blue]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold leading-tight">Estoque</h1>
              <p className="text-sm text-muted-foreground">
                Visão consolidada de inventários, carteira e divergências Tiny
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-1.5 backdrop-blur">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Select value={month} onValueChange={setMonth}>
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
        </div>

        {overview && (
          <>
            <Separator className="my-5" />
            <div className="relative grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiHero
                label="Saldo total"
                value={overview.totals.balance.toLocaleString("pt-BR")}
                hint={`${overview.totals.declared.toLocaleString("pt-BR")} declarado − ${overview.totals.committed.toLocaleString("pt-BR")} carteira`}
                icon={<Package className="h-4 w-4" />}
                tone={overview.totals.balance < 0 ? "danger" : "default"}
              />
              <KpiHero
                label="Carteira aberta"
                value={overview.totals.committed.toLocaleString("pt-BR")}
                hint="Pedidos consumindo estoque"
                icon={<ShoppingBag className="h-4 w-4" />}
              />
              <KpiHero
                label="Rupturas"
                value={overview.totals.breaks.toString()}
                hint={
                  overview.totals.breaks > 0
                    ? "Carteira excede estoque"
                    : "Sem quebra de estoque"
                }
                icon={<AlertTriangle className="h-4 w-4" />}
                tone={overview.totals.breaks > 0 ? "danger" : "success"}
              />
              <KpiHero
                label="Cobertura Tiny"
                value={`${overview.totals.coverage_pct}%`}
                hint={`${overview.totals.colors_count - overview.totals.missing} de ${overview.totals.colors_count} cor(es)`}
                icon={<TrendingUp className="h-4 w-4" />}
                tone={
                  overview.totals.coverage_pct === 100
                    ? "success"
                    : overview.totals.coverage_pct > 60
                      ? "default"
                      : "warning"
                }
                progress={overview.totals.coverage_pct}
              />
            </div>
          </>
        )}
      </div>

      {overviewQuery.isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !overview ? null : (
        <>
          {/* Alertas operacionais */}
          {hasAlerts && (
            <AlertsBanner overview={overview} canEdit={role === "MASTER"} />
          )}

          {/* Fornecedores */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              <Boxes className="h-3.5 w-3.5" />
              Fornecedores ({overview.suppliers.length})
            </h2>
            {overview.suppliers.length === 0 ? (
              <EmptyCard
                title="Nenhum fornecedor ativo"
                description="Cadastre um fornecedor em Configurações › Fornecedores para começar."
                action={
                  role === "MASTER" ? (
                    <Link href="/settings/suppliers">
                      <Button>Ir para fornecedores</Button>
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {overview.suppliers.map((s) => (
                  <SupplierCard key={s.id} supplier={s} />
                ))}
              </div>
            )}
          </section>

          {/* Produtos críticos */}
          {overview.critical_products.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                Atenção · {overview.critical_products.length} produto(s)
                crítico(s)
              </h2>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Produto</th>
                      <th className="px-4 py-2 text-left font-medium">
                        Fornecedor
                      </th>
                      <th className="px-4 py-2 text-right font-medium">
                        Declarado
                      </th>
                      <th className="px-4 py-2 text-right font-medium">
                        Carteira
                      </th>
                      <th className="px-4 py-2 text-right font-medium">Saldo</th>
                      <th className="px-4 py-2 text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {overview.critical_products.map((p) => (
                      <tr key={p.item_id} className="hover:bg-muted/30">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 shrink-0 overflow-hidden rounded border border-border bg-muted">
                              {p.product_image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.product_image}
                                  alt={p.product_name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                  <Package className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {p.product_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {p.color_label ?? "—"} ·{" "}
                                {p.pool === "PERSONALIZADO"
                                  ? "Personalizado"
                                  : "Marketplace"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">
                          {p.supplier_name ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-sm">
                          {p.declared.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-sm text-muted-foreground">
                          {p.committed.toLocaleString("pt-BR")}
                        </td>
                        <td
                          className={`px-4 py-2 text-right tabular-nums text-sm font-semibold ${
                            p.balance < 0 ? "text-destructive" : ""
                          }`}
                        >
                          {p.balance.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {p.supplier_id && (
                            <Link
                              href={`/settings/suppliers/${p.supplier_id}/inventory`}
                            >
                              <Button variant="ghost" size="sm">
                                Abrir
                                <ChevronRight className="ml-1 h-3 w-3" />
                              </Button>
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Produtos não configurados */}
          {overview.unconfigured.count > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5" />
                {overview.unconfigured.count} produto(s) não configurado(s)
              </h2>
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {overview.unconfigured.samples.map((p) => (
                    <Badge
                      key={p.id}
                      variant="outline"
                      className="gap-1.5 px-2 py-1"
                    >
                      <Package className="h-3 w-3 text-muted-foreground" />
                      {p.name}
                    </Badge>
                  ))}
                  {overview.unconfigured.count >
                    overview.unconfigured.samples.length && (
                    <Badge variant="outline" className="text-muted-foreground">
                      +{overview.unconfigured.count -
                        overview.unconfigured.samples.length}{" "}
                      mais
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Vincule cada produto a um fornecedor e selecione os pools
                    de estoque para incluí-los nos inventários.
                  </p>
                  <Link href="/settings/products">
                    <Button size="sm" variant="outline">
                      Ir para produtos
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function KpiHero({
  label,
  value,
  hint,
  icon,
  tone = "default",
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
  }[tone];
  const iconBg = {
    default: "bg-muted text-muted-foreground",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    danger: "bg-destructive/15 text-destructive",
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-background/80 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className={`rounded-md p-1.5 ${iconBg}`}>{icon}</div>
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      {progress != null && <Progress value={progress} className="mt-2 h-1.5" />}
    </div>
  );
}

function AlertsBanner({
  overview,
  canEdit,
}: {
  overview: Overview;
  canEdit: boolean;
}) {
  const alerts: Array<{
    label: string;
    description: string;
    tone: "danger" | "warning" | "info";
    href?: string;
    cta?: string;
  }> = [];

  if (overview.totals.breaks > 0) {
    alerts.push({
      label: `${overview.totals.breaks} ruptura(s) de estoque`,
      description: "Carteira do CRM excede o estoque declarado",
      tone: "danger",
    });
  }

  if (overview.pending_inventories.length > 0) {
    const draftCount = overview.pending_inventories.filter(
      (p) => p.status === "DRAFT"
    ).length;
    const submittedCount = overview.pending_inventories.filter(
      (p) => p.status === "SUBMITTED"
    ).length;
    alerts.push({
      label: `${overview.pending_inventories.length} inventário(s) pendente(s)`,
      description: `${draftCount} rascunho(s) · ${submittedCount} aguardando aprovação`,
      tone: "warning",
    });
  }

  if (overview.unconfigured.count > 0 && canEdit) {
    alerts.push({
      label: `${overview.unconfigured.count} produto(s) sem vínculo`,
      description: "Não estão em nenhum inventário até serem configurados",
      tone: "info",
      href: "/settings/products",
      cta: "Configurar",
    });
  }

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
        Tudo em ordem para o mês selecionado.
      </div>
    );
  }

  const toneCls = {
    danger: "border-destructive/40 bg-destructive/5 text-destructive",
    warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
    info: "border-border bg-muted/40 text-foreground",
  };
  const iconFor = {
    danger: <AlertTriangle className="h-4 w-4" />,
    warning: <Sparkles className="h-4 w-4" />,
    info: <Settings2 className="h-4 w-4" />,
  };

  return (
    <div className="grid gap-2 md:grid-cols-3">
      {alerts.map((a, idx) => (
        <div
          key={idx}
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${toneCls[a.tone]}`}
        >
          <div className="mt-0.5">{iconFor[a.tone]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{a.label}</p>
            <p className="text-xs opacity-80">{a.description}</p>
          </div>
          {a.href && a.cta && (
            <Link href={a.href}>
              <Button size="sm" variant="ghost" className="h-7 shrink-0">
                {a.cta}
              </Button>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

function SupplierCard({
  supplier,
}: {
  supplier: Overview["suppliers"][number];
}) {
  const hasInventory = !!supplier.inventory_id;
  const isBreak = supplier.breaks > 0;

  return (
    <Link
      href={`/settings/suppliers/${supplier.id}/inventory`}
      className="group block"
    >
      <div
        className={`relative h-full overflow-hidden rounded-xl border bg-card p-4 transition-all hover:shadow-md ${
          isBreak ? "border-destructive/40" : "border-border"
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{supplier.name}</h3>
            <div className="mt-1 flex items-center gap-1.5">
              {statusBadge(supplier.inventory_status)}
              {isBreak && (
                <Badge className="gap-1 bg-destructive/15 text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  Ruptura
                </Badge>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>

        {hasInventory ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label="Declarado"
                value={supplier.declared.toLocaleString("pt-BR")}
              />
              <Stat
                label="Carteira"
                value={supplier.committed.toLocaleString("pt-BR")}
                muted
              />
              <Stat
                label="Saldo"
                value={supplier.balance.toLocaleString("pt-BR")}
                accent={supplier.balance < 0 ? "danger" : "default"}
                bold
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Cobertura Tiny</span>
              <Progress value={supplier.coverage_pct} className="h-1.5 flex-1" />
              <span className="tabular-nums">{supplier.coverage_pct}%</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {supplier.colors_count} cor(es) · {supplier.items_count} linha(s)
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sem inventário no mês selecionado. Clique para criar.
          </p>
        )}
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
  muted,
  bold,
  accent = "default",
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  accent?: "default" | "danger";
}) {
  const cls = [
    "tabular-nums text-sm",
    muted ? "text-muted-foreground" : "",
    bold ? "font-semibold" : "",
    accent === "danger" ? "text-destructive" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cls}>{value}</p>
    </div>
  );
}

function EmptyCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
      <Boxes className="h-8 w-8 text-muted-foreground" />
      <div className="max-w-sm space-y-1">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
