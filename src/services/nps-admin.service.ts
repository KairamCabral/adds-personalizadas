/**
 * NPS — leitura/gestão para a área de staff (/settings/nps).
 * Usa o browser client (RLS restringe a MASTER/GESTOR). NÃO confundir com
 * nps.service.ts, que roda no servidor com service_role (cron + rota pública).
 */
import { createClient } from "@/lib/supabase/client";
import type { NpsTheme } from "@/lib/nps/scoring";
import type { Database } from "@/types/database.types";

const supabase = createClient();

export type NpsSurvey = Database["public"]["Tables"]["nps_surveys"]["Row"];
export type NpsResponseRow = Pick<
  Database["public"]["Tables"]["nps_responses"]["Row"],
  "id" | "score" | "category" | "comment" | "sales_channel" | "rep_id" | "responded_at"
>;
export type NpsFollowupStatus = Database["public"]["Enums"]["nps_followup_status"];

// ---------- Campanhas ----------
export async function getNpsSurveys(): Promise<NpsSurvey[]> {
  const { data, error } = await supabase
    .from("nps_surveys")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function setSurveyActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("nps_surveys")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;
}

// ---------- Métricas ----------
export async function getNpsResponses(fromIso?: string, toIso?: string): Promise<NpsResponseRow[]> {
  let q = supabase
    .from("nps_responses")
    .select("id, score, category, comment, sales_channel, rep_id, responded_at")
    .order("responded_at", { ascending: false });
  if (fromIso) q = q.gte("responded_at", fromIso);
  if (toIso) q = q.lte("responded_at", toIso);
  const { data, error } = await q.limit(2000);
  if (error) throw error;
  return data ?? [];
}

export async function getNpsThemeCounts(): Promise<{ theme: NpsTheme; count: number }[]> {
  const { data, error } = await supabase.from("nps_response_tags").select("theme").limit(5000);
  if (error) throw error;
  const counts = new Map<NpsTheme, number>();
  for (const row of data ?? []) {
    const t = row.theme as NpsTheme;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);
}

export interface DispatchCounts {
  sent: number;
  responded: number;
  pending: number;
}

export async function getDispatchCounts(fromIso?: string, toIso?: string): Promise<DispatchCounts> {
  const countFor = async (statuses: Database["public"]["Enums"]["nps_dispatch_status"][]) => {
    let q = supabase
      .from("nps_dispatches")
      .select("id", { count: "exact", head: true })
      .in("status", statuses);
    if (fromIso) q = q.gte("created_at", fromIso);
    if (toIso) q = q.lte("created_at", toIso);
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  };
  const [sent, responded, pending] = await Promise.all([
    countFor(["ENVIADO", "RESPONDIDO"]),
    countFor(["RESPONDIDO"]),
    countFor(["PENDENTE"]),
  ]);
  return { sent, responded, pending };
}

// ---------- Fila de detratores (closed-loop) ----------
export interface FollowupItem {
  id: string;
  status: NpsFollowupStatus;
  created_at: string;
  resolution_note: string | null;
  resolved_at: string | null;
  assigned_to: string | null;
  score: number | null;
  comment: string | null;
  clientName: string | null;
  orderId: string | null;
}

export async function getNpsFollowups(status?: NpsFollowupStatus): Promise<FollowupItem[]> {
  let fq = supabase
    .from("nps_followups")
    .select("id, status, created_at, resolution_note, resolved_at, assigned_to, response_id")
    .order("created_at", { ascending: false });
  if (status) fq = fq.eq("status", status);
  const { data: followups, error } = await fq.limit(500);
  if (error) throw error;
  if (!followups || followups.length === 0) return [];

  const respIds = followups.map((f) => f.response_id);
  const { data: responses } = await supabase
    .from("nps_responses")
    .select("id, score, comment, client_id, order_id")
    .in("id", respIds);
  const respMap = new Map((responses ?? []).map((r) => [r.id, r]));

  const clientIds = [
    ...new Set((responses ?? []).map((r) => r.client_id).filter((v): v is string => !!v)),
  ];
  const { data: clients } = clientIds.length
    ? await supabase.from("clients").select("id, name").in("id", clientIds)
    : { data: [] as { id: string; name: string }[] };
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c.name]));

  return followups.map((f) => {
    const r = respMap.get(f.response_id);
    return {
      id: f.id,
      status: f.status,
      created_at: f.created_at,
      resolution_note: f.resolution_note,
      resolved_at: f.resolved_at,
      assigned_to: f.assigned_to,
      score: r?.score ?? null,
      comment: r?.comment ?? null,
      clientName: r?.client_id ? (clientMap.get(r.client_id) ?? null) : null,
      orderId: r?.order_id ?? null,
    };
  });
}

export async function updateFollowup(
  id: string,
  status: NpsFollowupStatus,
  note?: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const resolving = status === "RESOLVIDO" || status === "DISPENSADO";
  const { error } = await supabase
    .from("nps_followups")
    .update({
      status,
      resolution_note: note ?? null,
      resolved_at: resolving ? new Date().toISOString() : null,
      resolved_by: resolving ? (user?.id ?? null) : null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function assignFollowupToMe(id: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");
  const { error } = await supabase
    .from("nps_followups")
    .update({ assigned_to: user.id, status: "EM_TRATATIVA" })
    .eq("id", id);
  if (error) throw error;
}
