"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";

// ────────────────────────────────────────────────────────────────────────────
// Configuração de ações
// ────────────────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  string,
  { icon: string; label: string; color: string; badgeClass: string }
> = {
  LOGIN: {
    icon: "🔑",
    label: "Login",
    color: "gray",
    badgeClass: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  LOGOUT: {
    icon: "🚪",
    label: "Logout",
    color: "gray",
    badgeClass: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  PROSPECT_CREATED: {
    icon: "📋",
    label: "Prospect criado",
    color: "blue",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  PROSPECT_MOVED: {
    icon: "↔️",
    label: "Prospect movido",
    color: "blue",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  VISIT_REGISTERED: {
    icon: "📍",
    label: "Visita registrada",
    color: "green",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  CLIENT_CREATED: {
    icon: "👤",
    label: "Cliente cadastrado",
    color: "purple",
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  },
  ORDER_CREATED: {
    icon: "🛒",
    label: "Pedido criado",
    color: "orange",
    badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  APP_OPENED: {
    icon: "📱",
    label: "App aberto",
    color: "gray",
    badgeClass: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  CRM_VIEWED: {
    icon: "👁️",
    label: "CRM visualizado",
    color: "gray",
    badgeClass: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

const DEFAULT_ACTION = {
  icon: "📌",
  label: "Ação",
  color: "gray",
  badgeClass: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] ?? { ...DEFAULT_ACTION, label: action };
}

// ────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  rep_id: string;
  rep_name: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Fetch functions
// ────────────────────────────────────────────────────────────────────────────

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

function periodToFromDate(period: string): string {
  const now = new Date();
  switch (period) {
    case "day":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "month":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case "3months":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}

async function fetchActivityLog(
  repFilter: string,
  actionFilter: string,
  period: string,
  page: number
): Promise<ActivityEntry[]> {
  const supabase = createClient();
  const PAGE_SIZE = 50;
  const fromDate = periodToFromDate(period);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("rep_activity_log")
    .select(
      `id, action, entity_type, entity_id, metadata, created_at, rep_id,
       profiles!rep_activity_log_rep_id_fkey(full_name)`
    )
    .gte("created_at", fromDate)
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (repFilter !== "all") {
    query = query.eq("rep_id", repFilter);
  }
  if (actionFilter !== "all") {
    query = query.eq("action", actionFilter);
  }

  const { data, error } = await query;
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((e: any) => ({
    id: e.id,
    action: e.action,
    entity_type: e.entity_type ?? null,
    entity_id: e.entity_id ?? null,
    metadata: e.metadata ?? null,
    created_at: e.created_at,
    rep_id: e.rep_id,
    rep_name: e.profiles?.full_name ?? null,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// KPI calculations
// ────────────────────────────────────────────────────────────────────────────

interface ActivityKpis {
  total: number;
  avgPerDay: number;
  mostActiveDay: string;
  peakHour: string;
}

function calcKpis(entries: ActivityEntry[]): ActivityKpis {
  if (!entries.length) {
    return { total: 0, avgPerDay: 0, mostActiveDay: "—", peakHour: "—" };
  }

  const dayCount: Record<string, number> = {};
  const hourCount: Record<number, number> = {};

  for (const e of entries) {
    const date = new Date(e.created_at);
    const dayKey = date.toLocaleDateString("pt-BR", { weekday: "long" });
    const dayISO = date.toISOString().slice(0, 10);
    dayCount[dayISO] = (dayCount[dayISO] ?? 0) + 1;
    const hour = date.getHours();
    hourCount[hour] = (hourCount[hour] ?? 0) + 1;
  }

  const uniqueDays = Object.keys(dayCount).length;
  const avgPerDay = uniqueDays > 0 ? Math.round(entries.length / uniqueDays) : entries.length;

  const mostActiveDayISO = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const mostActiveDay = mostActiveDayISO
    ? new Date(mostActiveDayISO + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" })
    : "—";

  const peakHourNum = Object.entries(hourCount).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0];
  const peakHour =
    peakHourNum !== undefined
      ? `${String(peakHourNum).padStart(2, "0")}:00`
      : "—";

  return { total: entries.length, avgPerDay, mostActiveDay, peakHour };
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ────────────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function buildDescription(entry: ActivityEntry): string {
  const meta = entry.metadata ?? {};
  switch (entry.action) {
    case "VISIT_REGISTERED":
      return [
        meta.prospect_name ? `Prospect: ${meta.prospect_name}` : null,
        meta.result ? `Resultado: ${meta.result}` : null,
      ]
        .filter(Boolean)
        .join(" | ") || "Visita registrada";
    case "PROSPECT_CREATED":
      return meta.name ? `Nome: ${meta.name}` : "Prospect criado";
    case "PROSPECT_MOVED":
      return meta.from && meta.to ? `${meta.from} → ${meta.to}` : "Status atualizado";
    case "ORDER_CREATED":
      return [
        meta.client_name ? `Cliente: ${meta.client_name}` : null,
        meta.total_qty ? `${meta.total_qty} unidades` : null,
      ]
        .filter(Boolean)
        .join(" | ") || "Pedido criado";
    case "CLIENT_CREATED":
      return meta.client_name ? `Nome: ${meta.client_name}` : "Cliente cadastrado";
    default:
      return "";
  }
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const cfg = getActionConfig(entry.action);
  const description = buildDescription(entry);
  const date = new Date(entry.created_at);
  const dateStr = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  const timeStr = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex gap-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-base">
        {cfg.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {dateStr} {timeStr}
          </span>
          {entry.rep_name && (
            <span className="font-medium text-sm">{entry.rep_name}</span>
          )}
          <Badge variant="outline" className={`text-xs px-1.5 py-0 ${cfg.badgeClass}`}>
            {cfg.label}
          </Badge>
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Página principal
// ────────────────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: "day", label: "Último dia" },
  { value: "week", label: "Última semana" },
  { value: "month", label: "Último mês" },
  { value: "3months", label: "Últimos 3 meses" },
];

const ACTION_OPTIONS = Object.entries(ACTION_CONFIG).map(([value, cfg]) => ({
  value,
  label: `${cfg.icon} ${cfg.label}`,
}));

export default function AtividadePage() {
  const { can, isLoading: permissionsLoading } = usePermissions();

  const [repFilter, setRepFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [period, setPeriod] = useState("week");
  const [page, setPage] = useState(0);

  const { data: reps = [] } = useQuery({
    queryKey: ["representantes-list-simple"],
    queryFn: fetchRepresentantes,
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["activity-log", repFilter, actionFilter, period, page],
    queryFn: () => fetchActivityLog(repFilter, actionFilter, period, page),
    enabled: !permissionsLoading && can("representantes.view"),
    staleTime: 60_000,
  });

  // Reset page quando filtros mudam
  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0);
  };

  const kpis = useMemo(() => calcKpis(entries), [entries]);

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Atividade dos Representantes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe em tempo real as ações dos representantes no app e no CRM.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <Select value={repFilter} onValueChange={handleFilterChange(setRepFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Representante" />
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

        <Select value={actionFilter} onValueChange={handleFilterChange(setActionFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo de ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {ACTION_OPTIONS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={handleFilterChange(setPeriod)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Ações no período" value={kpis.total} />
          <KpiCard label="Média por dia" value={kpis.avgPerDay} />
          <KpiCard label="Dia mais ativo" value={kpis.mostActiveDay} />
          <KpiCard label="Horário pico" value={kpis.peakHour} />
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Timeline de Atividades</h2>
        </div>

        {isLoading ? (
          <div className="divide-y px-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3 py-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-foreground">Nenhuma atividade encontrada</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tente ajustar os filtros ou selecionar um período maior.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y px-4">
              {entries.map((entry) => (
                <ActivityItem key={entry.id} entry={entry} />
              ))}
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Mostrando até {(page + 1) * 50} registros
              </p>
              <div className="flex gap-2">
                {page > 0 && (
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    ← Anterior
                  </button>
                )}
                {entries.length === 50 && (
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    Próximos →
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
