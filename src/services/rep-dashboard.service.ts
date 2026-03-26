import { createClient } from "@/lib/supabase/client";

// ============================================================
// TIPOS
// ============================================================

export interface RepSummary {
  id: string;
  full_name: string;
  avatar_url: string | null;
  commission_rate: number | null;
  is_active: boolean;
  vendidoMes: number;
  pedidosMes: number;
  visitasMes: number;
  conversaoPercent: number | null;
  metaVendas: number;
  lastActivityAt: string | null;
}

export interface DashboardAlert {
  severity: "critical" | "warning";
  icon: string;
  title: string;
  description: string;
  href: string;
}

export interface AttributionEntry {
  origin: string;
  value: number;
  count: number;
}

export interface PipelineOverviewData {
  VISITAR: number;
  RETORNO: number;
  VISITADO: number;
  lateReturns: { repId: string; repName: string; count: number }[];
  leadsWithoutVisit: number;
}

export interface CommissionRow {
  repId: string;
  repName: string;
  vendido: number;
  commissionRate: number | null;
  commission: number | null;
}

export interface EvolutionMonth {
  monthKey: string;
  monthLabel: string;
  totalSold: number;
  targetTotal: number;
  byRep: Record<string, number>;
}

export interface GestorDashboardData {
  reps: RepSummary[];
  totalSold: number;
  totalOrders: number;
  totalVisits: number;
  avgConversion: number | null;
  targetTotal: number;
  prevTotalSold: number;
  prevTotalOrders: number;
  attribution: AttributionEntry[];
  pipeline: PipelineOverviewData;
  alerts: DashboardAlert[];
  commissions: CommissionRow[];
  evolution: EvolutionMonth[];
  repsList: { id: string; full_name: string }[];
}

// ============================================================
// HELPERS
// ============================================================

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(monthKey: string): string {
  const [, m] = monthKey.split("-").map(Number);
  return MONTH_LABELS[m - 1];
}

function sumOrderItems(
  orderItems: { total_price?: number | null }[] | undefined
): number {
  return (orderItems ?? []).reduce((s, i) => s + (i.total_price ?? 0), 0);
}

// ============================================================
// SERVIÇO PRINCIPAL
// ============================================================

export async function getGestorDashboardData(
  month: Date,
  filterRepId?: string | null
): Promise<GestorDashboardData> {
  const supabase = createClient();

  const year = month.getFullYear();
  const m = month.getMonth();
  const monthStr = getMonthKey(month); // YYYY-MM (usado internamente)
  const monthDateStr = `${year}-${String(m + 1).padStart(2, "0")}-01`; // YYYY-MM-DD (para coluna DATE no Supabase)

  const monthStart = new Date(year, m, 1).toISOString();
  const monthEnd = new Date(year, m + 1, 1).toISOString();
  const prevMonthStart = new Date(year, m - 1, 1).toISOString();
  const prevMonthEnd = new Date(year, m, 1).toISOString();

  const evolutionMonths: string[] = [];
  for (let i = 5; i >= 0; i--) {
    evolutionMonths.push(getMonthKey(new Date(year, m - i, 1)));
  }
  const evolutionStart = new Date(year, m - 5, 1).toISOString();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const [
    repsResult,
    ordersCurrentResult,
    ordersPrevResult,
    ordersEvolutionResult,
    visitasCurrentResult,
    goalsCurrentResult,
    goalsEvolutionResult,
    prospectsResult,
    clientLinksResult,
    discountOrdersResult,
    lastActivityResult,
  ] = await Promise.allSettled([
    // 1. Representantes com notification_preferences (contém commission_rate e tiny_seller_id)
    supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, full_name, avatar_url, is_active, notification_preferences")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .eq("role", "REPRESENTANTE" as any)
      .order("full_name"),

    // 2. Pedidos do mês atual
    supabase
      .from("orders")
      .select("id, rep_id, origin, order_items(total_price)")
      .not("rep_id", "is", null)
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd),

    // 3. Pedidos do mês anterior (para comparação)
    supabase
      .from("orders")
      .select("id, rep_id, order_items(total_price)")
      .not("rep_id", "is", null)
      .gte("created_at", prevMonthStart)
      .lt("created_at", prevMonthEnd),

    // 4. Pedidos dos últimos 6 meses (para gráfico de evolução)
    supabase
      .from("orders")
      .select("id, rep_id, created_at, order_items(total_price)")
      .not("rep_id", "is", null)
      .gte("created_at", evolutionStart)
      .lt("created_at", monthEnd),

    // 5. Log de atividade do mês atual (visitas)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("rep_activity_log")
      .select("rep_id, created_at")
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd),

    // 6. Metas do mês atual
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("rep_goals")
      .select("rep_id, target_value, target_orders")
      .eq("month", monthDateStr),

    // 7. Metas dos últimos 6 meses (para linha de meta na evolução)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("rep_goals")
      .select("rep_id, month, target_value")
      .in("month", evolutionMonths.map((mk) => {
        const [ey, em] = mk.split("-");
        return `${ey}-${em}-01`;
      })),

    // 8. Prospects (pipeline consolidado)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("rep_prospects")
      .select("rep_id, status, return_date")
      .in("status", ["VISITAR", "RETORNO", "VISITADO"]),

    // 9. Vínculos com clientes (alertas de expiração)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("rep_client_links")
      .select("rep_id, visit_deadline_at, status")
      .eq("status", "ATIVO"),

    // 10. Pedidos com desconto pendente de aprovação
    supabase
      .from("orders")
      .select("id, rep_id")
      .not("rep_id", "is", null)
      .eq("discount_pending_approval", true),

    // 11. Última atividade por rep (últimos 30 dias) — para alertas de inatividade
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("rep_activity_log")
      .select("rep_id, created_at")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false }),
  ]);

  // Extrair dados com fallback seguro
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repsRaw: any[] =
    repsResult.status === "fulfilled" ? (repsResult.value.data ?? []) : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordersCurrent: any[] =
    ordersCurrentResult.status === "fulfilled"
      ? (ordersCurrentResult.value.data ?? [])
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordersPrev: any[] =
    ordersPrevResult.status === "fulfilled"
      ? (ordersPrevResult.value.data ?? [])
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordersEvolution: any[] =
    ordersEvolutionResult.status === "fulfilled"
      ? (ordersEvolutionResult.value.data ?? [])
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visitasCurrent: any[] =
    visitasCurrentResult.status === "fulfilled"
      ? (visitasCurrentResult.value?.data ?? [])
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const goalsCurrent: any[] =
    goalsCurrentResult.status === "fulfilled"
      ? (goalsCurrentResult.value?.data ?? [])
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const goalsEvolution: any[] =
    goalsEvolutionResult.status === "fulfilled"
      ? (goalsEvolutionResult.value?.data ?? [])
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prospects: any[] =
    prospectsResult.status === "fulfilled"
      ? (prospectsResult.value?.data ?? [])
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientLinks: any[] =
    clientLinksResult.status === "fulfilled"
      ? (clientLinksResult.value?.data ?? [])
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discountOrders: any[] =
    discountOrdersResult.status === "fulfilled"
      ? (discountOrdersResult.value.data ?? [])
      : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastActivityRaw: any[] =
    lastActivityResult.status === "fulfilled"
      ? (lastActivityResult.value?.data ?? [])
      : [];

  // ---- Processar representantes ----
  const allReps = repsRaw.map((r) => {
    const extras =
      (r.notification_preferences as Record<string, unknown> | null) ?? {};
    return {
      id: r.id as string,
      full_name: r.full_name as string,
      avatar_url: (r.avatar_url as string | null) ?? null,
      is_active: (r.is_active as boolean | null) ?? true,
      commission_rate: (extras.commission_rate as number | null) ?? null,
    };
  });

  const filteredRepIds = filterRepId
    ? [filterRepId]
    : allReps.map((r) => r.id);

  // ---- Mapa de última atividade (30 dias) ----
  const lastActivityMap: Record<string, string> = {};
  for (const a of lastActivityRaw) {
    if (!lastActivityMap[a.rep_id]) {
      lastActivityMap[a.rep_id] = a.created_at;
    }
  }

  // ---- Metas do mês atual ----
  const goalsMap: Record<string, { target_value: number; target_orders: number }> = {};
  for (const g of goalsCurrent) {
    goalsMap[g.rep_id] = {
      target_value: g.target_value ?? 0,
      target_orders: g.target_orders ?? 0,
    };
  }

  // ---- Processar pedidos do mês atual ----
  const ordersCurrentByRep: Record<
    string,
    { value: number; count: number }
  > = {};
  const attributionMap: Record<string, { value: number; count: number }> = {};

  for (const o of ordersCurrent) {
    if (!filteredRepIds.includes(o.rep_id)) continue;
    if (!ordersCurrentByRep[o.rep_id]) {
      ordersCurrentByRep[o.rep_id] = { value: 0, count: 0 };
    }
    const val = sumOrderItems(o.order_items);
    ordersCurrentByRep[o.rep_id].value += val;
    ordersCurrentByRep[o.rep_id].count++;

    const origin = (o.origin as string | null) ?? "OUTROS";
    if (!attributionMap[origin]) attributionMap[origin] = { value: 0, count: 0 };
    attributionMap[origin].value += val;
    attributionMap[origin].count++;
  }

  // ---- Processar atividade do mês ----
  // rep_activity_log não tem coluna result; conversão não pode ser calculada aqui
  const visitasByRep: Record<string, { total: number; sales: number }> = {};
  for (const v of visitasCurrent) {
    if (!filteredRepIds.includes(v.rep_id)) continue;
    if (!visitasByRep[v.rep_id]) visitasByRep[v.rep_id] = { total: 0, sales: 0 };
    visitasByRep[v.rep_id].total++;
  }

  // ---- Construir resumos por rep ----
  const filteredReps = allReps.filter((r) => filteredRepIds.includes(r.id));

  const repSummaries: RepSummary[] = filteredReps.map((r) => {
    const orders = ordersCurrentByRep[r.id] ?? { value: 0, count: 0 };
    const visitas = visitasByRep[r.id] ?? { total: 0, sales: 0 };
    const goal = goalsMap[r.id] ?? { target_value: 0, target_orders: 0 };

    return {
      id: r.id,
      full_name: r.full_name,
      avatar_url: r.avatar_url,
      commission_rate: r.commission_rate,
      is_active: r.is_active ?? true,
      vendidoMes: orders.value,
      pedidosMes: orders.count,
      visitasMes: visitas.total,
      conversaoPercent:
        visitas.total > 0
          ? Math.round((visitas.sales / visitas.total) * 100)
          : null,
      metaVendas: goal.target_value,
      lastActivityAt: lastActivityMap[r.id] ?? null,
    };
  });

  // ---- Totais gerais ----
  const totalSold = repSummaries.reduce((s, r) => s + r.vendidoMes, 0);
  const totalOrders = repSummaries.reduce((s, r) => s + r.pedidosMes, 0);
  const totalVisits = repSummaries.reduce((s, r) => s + r.visitasMes, 0);
  const targetTotal = repSummaries.reduce((s, r) => s + r.metaVendas, 0);

  const conversions = repSummaries
    .filter((r) => r.conversaoPercent !== null)
    .map((r) => r.conversaoPercent!);
  const avgConversion =
    conversions.length > 0
      ? Math.round(conversions.reduce((s, v) => s + v, 0) / conversions.length)
      : null;

  // ---- Mês anterior ----
  let prevTotalSold = 0;
  let prevTotalOrders = 0;
  for (const o of ordersPrev) {
    if (!filteredRepIds.includes(o.rep_id)) continue;
    prevTotalSold += sumOrderItems(o.order_items);
    prevTotalOrders++;
  }

  // ---- Atribuição ----
  const attribution: AttributionEntry[] = Object.entries(attributionMap).map(
    ([origin, data]) => ({ origin, value: data.value, count: data.count })
  );

  // ---- Pipeline ----
  const pipelineCount = { VISITAR: 0, RETORNO: 0, VISITADO: 0 };
  const lateReturnsMap: Record<string, number> = {};

  for (const p of prospects) {
    if (!filteredRepIds.includes(p.rep_id)) continue;
    const status = p.status as keyof typeof pipelineCount;
    if (status in pipelineCount) pipelineCount[status]++;
    if (
      status === "RETORNO" &&
      p.return_date &&
      p.return_date < today
    ) {
      lateReturnsMap[p.rep_id] = (lateReturnsMap[p.rep_id] ?? 0) + 1;
    }
  }

  const lateReturns = Object.entries(lateReturnsMap).map(
    ([repId, count]) => ({
      repId,
      repName:
        allReps.find((r) => r.id === repId)?.full_name ?? repId,
      count,
    })
  );

  const pipeline: PipelineOverviewData = {
    ...pipelineCount,
    lateReturns,
    leadsWithoutVisit: 0,
  };

  // ---- Alertas ----
  const alerts: DashboardAlert[] = [];

  // Reps inativos (> 7 dias sem ação)
  for (const r of filteredReps) {
    const lastAct = lastActivityMap[r.id] ?? null;
    if (!lastAct || lastAct < sevenDaysAgo) {
      alerts.push({
        severity: "critical",
        icon: "🔴",
        title: `${r.full_name} inativo`,
        description: lastAct
          ? "Última ação há mais de 7 dias"
          : "Sem atividade registrada",
        href: `/representantes/${r.id}`,
      });
    }
  }

  // Descontos pendentes de aprovação
  const discountCount = discountOrders.filter((o) =>
    filteredRepIds.includes(o.rep_id)
  ).length;
  if (discountCount > 0) {
    alerts.push({
      severity: "warning",
      icon: "🟡",
      title: `${discountCount} pedido${discountCount > 1 ? "s" : ""} com desconto pendente`,
      description: "Aguardando aprovação de desconto",
      href: "/pipeline",
    });
  }

  // Vínculos expirando em < 30 dias
  for (const r of filteredReps) {
    const expiring = clientLinks.filter(
      (l) =>
        l.rep_id === r.id &&
        l.visit_deadline_at &&
        l.visit_deadline_at < thirtyDaysFromNow
    );
    if (expiring.length > 0) {
      alerts.push({
        severity: "warning",
        icon: "🟡",
        title: `${expiring.length} vínculo${expiring.length > 1 ? "s" : ""} expirando — ${r.full_name}`,
        description: "Clientes perderão vínculo em menos de 30 dias",
        href: `/representantes/${r.id}?tab=visitas`,
      });
    }
  }

  // Ordenar: críticos primeiro
  alerts.sort((a, b) =>
    a.severity === "critical" && b.severity !== "critical" ? -1 : 0
  );

  // ---- Comissões ----
  const commissions: CommissionRow[] = filteredReps.map((r) => {
    const vendido = ordersCurrentByRep[r.id]?.value ?? 0;
    const rate = r.commission_rate;
    const commission =
      rate !== null && rate > 0 ? vendido * (rate / 100) : null;
    return {
      repId: r.id,
      repName: r.full_name,
      vendido,
      commissionRate: rate,
      commission,
    };
  });

  // ---- Evolução (últimos 6 meses) ----
  const evolutionMap: Record<string, Record<string, number>> = {};
  for (const mKey of evolutionMonths) {
    evolutionMap[mKey] = {};
    for (const r of filteredReps) {
      evolutionMap[mKey][r.id] = 0;
    }
  }

  for (const o of ordersEvolution) {
    if (!filteredRepIds.includes(o.rep_id)) continue;
    const mKey = (o.created_at as string).slice(0, 7);
    if (!evolutionMap[mKey]) continue;
    const val = sumOrderItems(o.order_items);
    evolutionMap[mKey][o.rep_id] = (evolutionMap[mKey][o.rep_id] ?? 0) + val;
  }

  const evolutionGoalsMap: Record<string, number> = {};
  for (const g of goalsEvolution) {
    if (!filteredRepIds.includes(g.rep_id)) continue;
    // month vem do DB como DATE (YYYY-MM-DD), normalizar para YYYY-MM
    const mKey = (g.month as string).slice(0, 7);
    evolutionGoalsMap[mKey] = (evolutionGoalsMap[mKey] ?? 0) + (g.target_value ?? 0);
  }

  const evolution: EvolutionMonth[] = evolutionMonths.map((mKey) => {
    const byRep = evolutionMap[mKey] ?? {};
    const totalSoldEvol = Object.values(byRep).reduce((s, v) => s + v, 0);
    return {
      monthKey: mKey,
      monthLabel: getMonthLabel(mKey),
      totalSold: totalSoldEvol,
      targetTotal: evolutionGoalsMap[mKey] ?? 0,
      byRep,
    };
  });

  return {
    reps: repSummaries,
    totalSold,
    totalOrders,
    totalVisits,
    avgConversion,
    targetTotal,
    prevTotalSold,
    prevTotalOrders,
    attribution,
    pipeline,
    alerts,
    commissions,
    evolution,
    repsList: allReps.map((r) => ({ id: r.id, full_name: r.full_name })),
  };
}
