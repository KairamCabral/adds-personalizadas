import { createClient } from "@/lib/supabase/client";

// ============================================================
// TIPOS
// ============================================================

export interface RepresentanteDetail {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
  tiny_seller_id: string | null;
  commission_rate: number | null;
}

export interface RepresentanteKpis {
  vendidoMes: number;
  metaVendas: number;
  pedidosMes: number;
  metaPedidos: number;
  visitasMes: number;
  conversaoPercent: number | null;
  clientesAtivos: number;
  clientesVisitados: number;
  clientesPerdendoVinculo: number;
  territories: RepresentanteTerritory[];
  lastActivityAt: string | null;
}

export interface RepresentanteTerritory {
  id: string;
  rep_id: string;
  city: string;
  state: string;
}

export interface TerritoryConflict {
  city: string;
  state: string;
  otherRepName: string;
}

export interface RepresentanteData {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
  territories: string[];
  goalTarget: number;
  ordersCount: number;
  visitasCount: number;
  lastActivityAt: string | null;
}

export type ActivityStatus = "ativo" | "alerta" | "inativo";

export function getActivityStatus(lastActivityAt: string | null): ActivityStatus {
  if (!lastActivityAt) return "inativo";
  const diffDays = (Date.now() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 3) return "ativo";
  if (diffDays <= 7) return "alerta";
  return "inativo";
}

export function calcGoalPercent(ordersCount: number, goalTarget: number): number | null {
  if (!goalTarget) return null;
  return Math.round((ordersCount / goalTarget) * 100);
}

export async function getRepresentantes(): Promise<RepresentanteData[]> {
  const supabase = createClient();

  const { data: reps, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, phone, is_active")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq("role", "REPRESENTANTE" as any)
    .order("full_name");

  if (error) throw error;
  if (!reps?.length) return [];

  const repIds = reps.map((r) => r.id);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const currentMonth = `${year}-${month}-01`;
  const monthStart = new Date(year, now.getMonth(), 1).toISOString();
  const monthEnd = new Date(year, now.getMonth() + 1, 1).toISOString();

  // Territories
  const territoriesMap: Record<string, string[]> = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("rep_territories")
      .select("rep_id, city")
      .in("rep_id", repIds);
    if (data) {
      for (const t of data) {
        if (!territoriesMap[t.rep_id]) territoriesMap[t.rep_id] = [];
        territoriesMap[t.rep_id].push(t.city);
      }
    }
  } catch {
    // Table may not exist yet
  }

  // Goals for current month
  const goalsMap: Record<string, number> = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("rep_goals")
      .select("rep_id, target_value")
      .in("rep_id", repIds)
      .eq("month", currentMonth);
    if (data) {
      for (const g of data) {
        goalsMap[g.rep_id] = g.target_value ?? 0;
      }
    }
  } catch {
    // Table may not exist yet
  }

  // Orders count for current month
  const ordersMap: Record<string, number> = {};
  try {
    const { data } = await supabase
      .from("orders")
      .select("rep_id")
      .in("rep_id", repIds)
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd);
    if (data) {
      for (const o of data) {
        if (o.rep_id) {
          ordersMap[o.rep_id] = (ordersMap[o.rep_id] ?? 0) + 1;
        }
      }
    }
  } catch {
    // Graceful fallback
  }

  // Visitas (activity count for current month) + last activity
  const visitasMap: Record<string, number> = {};
  const activityMap: Record<string, string> = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("rep_activity_log")
      .select("rep_id, created_at")
      .in("rep_id", repIds)
      .order("created_at", { ascending: false });
    if (data) {
      for (const a of data) {
        if (!activityMap[a.rep_id]) {
          activityMap[a.rep_id] = a.created_at;
        }
        if (a.created_at >= monthStart && a.created_at < monthEnd) {
          visitasMap[a.rep_id] = (visitasMap[a.rep_id] ?? 0) + 1;
        }
      }
    }
  } catch {
    // Table may not exist yet
  }

  return reps.map((rep) => ({
    id: rep.id,
    full_name: rep.full_name,
    email: rep.email,
    avatar_url: rep.avatar_url,
    phone: rep.phone,
    is_active: rep.is_active,
    territories: territoriesMap[rep.id] ?? [],
    goalTarget: goalsMap[rep.id] ?? 0,
    ordersCount: ordersMap[rep.id] ?? 0,
    visitasCount: visitasMap[rep.id] ?? 0,
    lastActivityAt: activityMap[rep.id] ?? null,
  }));
}

// ============================================================
// DETALHE DO REPRESENTANTE
// ============================================================

export async function getRepresentanteById(repId: string): Promise<RepresentanteDetail | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, phone, is_active, notification_preferences")
    .eq("id", repId)
    .single();

  if (error || !data) return null;

  // notification_preferences é usado como campo genérico para guardar extras
  const extras = (data.notification_preferences as Record<string, unknown> | null) ?? {};

  return {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    avatar_url: data.avatar_url,
    phone: data.phone,
    is_active: data.is_active,
    tiny_seller_id: (extras.tiny_seller_id as string | null) ?? null,
    commission_rate: (extras.commission_rate as number | null) ?? null,
  };
}

export async function updateRepresentanteExtras(
  repId: string,
  extras: { tiny_seller_id?: string | null; commission_rate?: number | null }
): Promise<void> {
  const supabase = createClient();

  // Fetch current notification_preferences to merge
  const { data: current } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", repId)
    .single();

  const currentExtras = (current?.notification_preferences as Record<string, unknown> | null) ?? {};
  const updated = { ...currentExtras, ...extras };

  const { error } = await supabase
    .from("profiles")
    .update({ notification_preferences: updated })
    .eq("id", repId);

  if (error) throw error;
}

// ============================================================
// KPIs DO REPRESENTANTE
// ============================================================

export async function getRepresentanteKpis(
  repId: string,
  month: Date
): Promise<RepresentanteKpis> {
  const supabase = createClient();

  const year = month.getFullYear();
  const m = month.getMonth();
  const monthStr = `${year}-${String(m + 1).padStart(2, "0")}-01`;
  const monthStart = new Date(year, m, 1).toISOString();
  const monthEnd = new Date(year, m + 1, 1).toISOString();
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const results = await Promise.allSettled([
    // 1. Goals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("rep_goals")
      .select("target_value, target_orders")
      .eq("rep_id", repId)
      .eq("month", monthStr)
      .maybeSingle(),

    // 2. Orders do mês
    supabase
      .from("orders")
      .select("id, order_items(total_price)")
      .eq("rep_id", repId)
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd),

    // 3. Visitas do mês
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("rep_activity_log")
      .select("id, created_at")
      .eq("rep_id", repId)
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd),

    // 4. Clientes ativos no vínculo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("rep_client_links")
      .select("id, client_id, visit_deadline_at")
      .eq("rep_id", repId)
      .eq("status", "ATIVO"),

    // 5. Territórios
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("rep_territories")
      .select("id, rep_id, city, state")
      .eq("rep_id", repId),

    // 6. Última atividade
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("rep_activity_log")
      .select("created_at")
      .eq("rep_id", repId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const goalData = results[0].status === "fulfilled" ? results[0].value?.data : null;
  const ordersData = results[1].status === "fulfilled" ? results[1].value?.data ?? [] : [];
  const visitasData = results[2].status === "fulfilled" ? results[2].value?.data ?? [] : [];
  const clientLinksData = results[3].status === "fulfilled" ? results[3].value?.data ?? [] : [];
  const territoriesData = results[4].status === "fulfilled" ? results[4].value?.data ?? [] : [];
  const lastActivityData = results[5].status === "fulfilled" ? results[5].value?.data : null;

  // Calcular vendido no mês (soma dos itens dos pedidos)
  let vendidoMes = 0;
  for (const order of ordersData) {
    const items = (order as { order_items?: { total_price?: number | null }[] }).order_items ?? [];
    for (const item of items) {
      vendidoMes += item.total_price ?? 0;
    }
  }

  const pedidosMes = ordersData.length;
  const visitasMes = visitasData.length;

  // Conversão: não disponível via rep_activity_log (tabela não tem coluna result)
  const conversaoPercent: number | null = null;

  // Clientes ativos, visitados no mês, perdendo vínculo
  const clientesAtivos = clientLinksData.length;
  const clientesVisitados = 0;
  const clientesPerdendoVinculo = clientLinksData.filter(
    (l: { visit_deadline_at?: string | null }) =>
      l.visit_deadline_at && l.visit_deadline_at < thirtyDaysFromNow
  ).length;

  return {
    vendidoMes,
    metaVendas: (goalData?.target_value as number | null) ?? 0,
    pedidosMes,
    metaPedidos: (goalData?.target_orders as number | null) ?? 0,
    visitasMes,
    conversaoPercent,
    clientesAtivos,
    clientesVisitados,
    clientesPerdendoVinculo,
    territories: territoriesData as RepresentanteTerritory[],
    lastActivityAt: lastActivityData?.created_at ?? null,
  };
}

// ============================================================
// TERRITÓRIOS — CRUD
// ============================================================

export async function getRepresentanteTerritories(
  repId: string
): Promise<RepresentanteTerritory[]> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("rep_territories")
    .select("id, rep_id, city, state")
    .eq("rep_id", repId)
    .order("state")
    .order("city");

  if (error) throw error;
  return (data ?? []) as RepresentanteTerritory[];
}

export async function checkTerritoryConflict(
  city: string,
  state: string,
  excludeRepId: string
): Promise<TerritoryConflict | null> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("rep_territories")
    .select("rep_id, city, state, profiles(full_name)")
    .ilike("city", city.trim())
    .ilike("state", state.trim())
    .neq("rep_id", excludeRepId)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    city: data.city,
    state: data.state,
    otherRepName: (data.profiles as { full_name?: string } | null)?.full_name ?? "outro representante",
  };
}

export async function addRepresentanteTerritory(
  repId: string,
  city: string,
  state: string
): Promise<RepresentanteTerritory> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("rep_territories")
    .insert({ rep_id: repId, city: city.trim(), state: state.trim().toUpperCase() })
    .select()
    .single();

  if (error) throw error;
  return data as RepresentanteTerritory;
}

export async function removeRepresentanteTerritory(territoryId: string): Promise<void> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("rep_territories")
    .delete()
    .eq("id", territoryId);

  if (error) throw error;
}

// ============================================================
// METAS (rep_goals)
// ============================================================

export interface RepGoal {
  id: string;
  rep_id: string;
  month: string; // YYYY-MM
  target_value: number;
  target_orders: number | null;
}

export interface RepGoalWithActual extends RepGoal {
  actual_value: number;
  actual_orders: number;
  achievement_percent: number | null;
}

export async function getRepGoalsWithActuals(repId: string): Promise<RepGoalWithActual[]> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: goals, error: goalsError } = await (supabase as any)
    .from("rep_goals")
    .select("id, rep_id, month, target_value, target_orders")
    .eq("rep_id", repId)
    .order("month", { ascending: false });

  if (goalsError) throw goalsError;
  if (!goals?.length) return [];

  const typedGoals = goals as RepGoal[];
  const months = typedGoals.map((g) => g.month).sort();
  const earliestMonth = months[0];
  const [eyear, emonth] = earliestMonth.split("-").map(Number);
  const fromDate = new Date(eyear, emonth - 1, 1).toISOString();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, created_at, order_items(total_price)")
    .eq("rep_id", repId)
    .gte("created_at", fromDate);

  const monthlyData: Record<string, { value: number; count: number }> = {};
  for (const order of orders ?? []) {
    const monthKey = (order.created_at as string).slice(0, 7);
    if (!monthlyData[monthKey]) monthlyData[monthKey] = { value: 0, count: 0 };
    monthlyData[monthKey].count++;
    const items = (order as { order_items?: { total_price?: number | null }[] }).order_items ?? [];
    for (const item of items) {
      monthlyData[monthKey].value += item.total_price ?? 0;
    }
  }

  return typedGoals.map((g) => {
    // month vem do DB como DATE (YYYY-MM-DD), normalizar para YYYY-MM para comparar com monthlyData
    const monthKey = g.month.slice(0, 7);
    const actual_value = monthlyData[monthKey]?.value ?? 0;
    const actual_orders = monthlyData[monthKey]?.count ?? 0;
    const achievement_percent =
      g.target_value > 0 ? Math.round((actual_value / g.target_value) * 100) : null;
    return { ...g, month: monthKey, actual_value, actual_orders, achievement_percent };
  });
}

export async function createRepGoal(
  repId: string,
  month: string,
  targetValue: number,
  targetOrders: number | null
): Promise<RepGoal> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("rep_goals")
    .insert({ rep_id: repId, month, target_value: targetValue, target_orders: targetOrders })
    .select()
    .single();
  if (error) throw error;
  return data as RepGoal;
}

export async function updateRepGoal(
  id: string,
  updates: { target_value?: number; target_orders?: number | null }
): Promise<void> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("rep_goals").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteRepGoal(id: string): Promise<void> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("rep_goals").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// PROSPECTS (rep_prospects)
// ============================================================

export type ProspectStatus = "VISITAR" | "RETORNO" | "VISITADO";

export interface RepProspect {
  id: string;
  rep_id: string;
  name: string;
  segment: string | null;
  city: string | null;
  state: string | null;
  status: ProspectStatus;
  return_date: string | null;
  notes: string | null;
}

export async function getRepProspects(repId: string): Promise<RepProspect[]> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("rep_prospects")
    .select("id, rep_id, name, segment, city, state, status, return_date, notes")
    .eq("rep_id", repId)
    .in("status", ["VISITAR", "RETORNO", "VISITADO"])
    .order("name");

  if (error) throw error;
  return (data ?? []) as RepProspect[];
}

// ============================================================
// VISITAS (rep_visits)
// ============================================================

export interface RepVisit {
  id: string;
  rep_id: string;
  prospect_id: string | null;
  prospect_name: string | null;
  checked_in_at: string;
  visit_type: string | null;
  result: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  address_detected: string | null;
}

export async function getRepVisits(repId: string, days: number, page = 0): Promise<RepVisit[]> {
  const supabase = createClient();
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const PAGE_SIZE = 20;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("rep_visits")
    .select(
      "id, rep_id, prospect_id, checked_in_at, visit_type, result, notes, latitude, longitude, address_detected, rep_prospects(name)"
    )
    .eq("rep_id", repId)
    .gte("checked_in_at", fromDate)
    .order("checked_in_at", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((v: any) => ({
    ...v,
    prospect_name: v.rep_prospects?.name ?? null,
  })) as RepVisit[];
}

// ============================================================
// PEDIDOS DO REPRESENTANTE
// ============================================================

export interface RepOrderSummary {
  id: string;
  order_number: number;
  title: string;
  status: string;
  is_personalized: boolean | null;
  discount_percentage: number | null;
  created_at: string;
  client_name: string | null;
}

export async function getRepOrders(
  repId: string,
  monthFilter?: string
): Promise<RepOrderSummary[]> {
  const supabase = createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, title, status, is_personalized, discount_percentage, created_at, clients(name)"
    )
    .eq("rep_id", repId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (monthFilter) {
    const [fyear, fmonth] = monthFilter.split("-").map(Number);
    const from = new Date(fyear, fmonth - 1, 1).toISOString();
    const to = new Date(fyear, fmonth, 1).toISOString();
    query = query.gte("created_at", from).lt("created_at", to);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((o) => ({
    ...o,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client_name: (o as any).clients?.name ?? null,
  }));
}
