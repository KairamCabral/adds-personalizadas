/**
 * NPS — lógica de servidor (chamada por cron e pela rota pública de resposta).
 * Usa o admin client (service_role) pois roda fora de sessão de usuário.
 */
import { resolveChannel } from "@/lib/nps/channels";
import type { NpsCategory, NpsTheme } from "@/lib/nps/scoring";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.addsbrasil.com.br";

export function npsSurveyUrl(token: string): string {
  return `${APP_URL.replace(/\/$/, "")}/nps/${token}`;
}

function firstName(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  return trimmed ? (trimmed.split(/\s+/)[0] ?? null) : null;
}

function buildMap<T extends { id: string }>(rows: T[] | null): Map<string, T> {
  const map = new Map<string, T>();
  for (const r of rows ?? []) map.set(r.id, r);
  return map;
}

export interface DispatchRunResult {
  expired: number;
  processed: number;
  sent: number;
  failed: number;
  reminders: number;
}

/**
 * Processa a fila de disparos NPS:
 *  1) expira disparos vencidos sem resposta;
 *  2) envia PENDENTES já agendados (após o delay);
 *  3) envia lembretes a quem não respondeu (respeitando max_reminders).
 */
export async function processNpsDispatches(): Promise<DispatchRunResult> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const result: DispatchRunResult = {
    expired: 0,
    processed: 0,
    sent: 0,
    failed: 0,
    reminders: 0,
  };

  // 1) Expirar vencidos sem resposta
  const { data: expired } = await admin
    .from("nps_dispatches")
    .update({ status: "EXPIRADO" })
    .lt("expires_at", nowIso)
    .in("status", ["PENDENTE", "ENVIADO"])
    .select("id");
  result.expired = expired?.length ?? 0;

  // 2) Enviar PENDENTES agendados
  const { data: due } = await admin
    .from("nps_dispatches")
    .select(
      "id, token, channel, recipient_email, recipient_phone, client_id, order_id",
    )
    .eq("status", "PENDENTE")
    .lte("scheduled_for", nowIso)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`) // defesa: NULL não fica preso
    .order("scheduled_for", { ascending: true })
    .limit(100);

  if (due && due.length) {
    const { clients, orders } = await fetchNames(admin, due);
    for (const d of due) {
      result.processed++;
      const to = d.channel === "EMAIL" ? d.recipient_email : d.recipient_phone;
      const channel = resolveChannel(d.channel);
      if (!to || !channel.isConfigured()) {
        await admin
          .from("nps_dispatches")
          .update({
            status: "FALHOU",
            send_error: !channel.isConfigured()
              ? `Canal ${d.channel} não configurado`
              : "Sem destinatário",
          })
          .eq("id", d.id);
        result.failed++;
        continue;
      }
      const r = await channel.send({
        to,
        clientName: firstName(d.client_id ? clients.get(d.client_id)?.name : null),
        surveyUrl: npsSurveyUrl(d.token),
        orderTitle: d.order_id ? (orders.get(d.order_id)?.title ?? null) : null,
        isReminder: false,
      });
      if (r.success) {
        await admin
          .from("nps_dispatches")
          .update({ status: "ENVIADO", sent_at: new Date().toISOString(), send_error: null })
          .eq("id", d.id);
        result.sent++;
      } else {
        await admin
          .from("nps_dispatches")
          .update({ status: "FALHOU", send_error: r.error ?? "Falha no envio" })
          .eq("id", d.id);
        result.failed++;
      }
    }
  }

  // 3) Lembretes (ENVIADO, não respondido, dentro do prazo, abaixo do limite)
  const { data: toRemind } = await admin
    .from("nps_dispatches")
    .select(
      "id, token, channel, recipient_email, recipient_phone, client_id, order_id, reminders_sent, sent_at, last_reminder_at, nps_surveys(max_reminders, reminder_after_hours)",
    )
    .eq("status", "ENVIADO")
    .gt("expires_at", nowIso)
    .limit(100);

  if (toRemind && toRemind.length) {
    const { clients, orders } = await fetchNames(admin, toRemind);
    for (const d of toRemind) {
      const survey = Array.isArray(d.nps_surveys) ? d.nps_surveys[0] : d.nps_surveys;
      if (!survey) continue;
      if ((d.reminders_sent ?? 0) >= survey.max_reminders) continue;

      const since = d.last_reminder_at ?? d.sent_at;
      if (!since) continue;
      const hours = (Date.now() - new Date(since).getTime()) / 3_600_000;
      if (hours < survey.reminder_after_hours) continue;

      const to = d.channel === "EMAIL" ? d.recipient_email : d.recipient_phone;
      const channel = resolveChannel(d.channel);
      if (!to || !channel.isConfigured()) continue;

      const r = await channel.send({
        to,
        clientName: firstName(d.client_id ? clients.get(d.client_id)?.name : null),
        surveyUrl: npsSurveyUrl(d.token),
        orderTitle: d.order_id ? (orders.get(d.order_id)?.title ?? null) : null,
        isReminder: true,
      });
      if (r.success) {
        await admin
          .from("nps_dispatches")
          .update({
            reminders_sent: (d.reminders_sent ?? 0) + 1,
            last_reminder_at: new Date().toISOString(),
          })
          .eq("id", d.id);
        result.reminders++;
      }
    }
  }

  return result;
}

type Admin = ReturnType<typeof createAdminClient>;

async function fetchNames(
  admin: Admin,
  rows: { client_id: string | null; order_id: string | null }[],
): Promise<{
  clients: Map<string, { id: string; name: string }>;
  orders: Map<string, { id: string; title: string }>;
}> {
  const clientIds = [...new Set(rows.map((r) => r.client_id).filter((v): v is string => !!v))];
  const orderIds = [...new Set(rows.map((r) => r.order_id).filter((v): v is string => !!v))];

  const [clientsRes, ordersRes] = await Promise.all([
    clientIds.length
      ? admin.from("clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    orderIds.length
      ? admin.from("orders").select("id, title").in("id", orderIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  return {
    clients: buildMap(clientsRes.data),
    orders: buildMap(ordersRes.data),
  };
}

export interface SubmitNpsParams {
  token: string;
  score: number;
  comment?: string | null;
  themes?: NpsTheme[] | null;
  allowContact?: boolean;
  allowTestimonial?: boolean;
  meta?: Record<string, unknown> | null;
}

export interface SubmitNpsResult {
  ok: boolean;
  category: NpsCategory | null;
  message: string;
}

/**
 * Registra a resposta pública via RPC atômico (valida token + grava + marca
 * RESPONDIDO). Se for DETRATOR, dispara o alerta closed-loop para a equipe.
 */
export async function submitNpsResponse(params: SubmitNpsParams): Promise<SubmitNpsResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("submit_nps_response", {
    p_token: params.token,
    p_score: params.score,
    p_comment: params.comment ?? undefined,
    p_allow_contact: params.allowContact ?? true,
    p_allow_testimonial: params.allowTestimonial ?? false,
    p_themes: params.themes ?? undefined,
    p_meta: (params.meta ?? null) as Json,
  });

  if (error) {
    console.error("[nps.service] submit_nps_response", error.message);
    return { ok: false, category: null, message: "Erro ao registrar sua resposta." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.ok) {
    return { ok: false, category: null, message: row?.message ?? "Não foi possível registrar." };
  }

  if (row.category === "DETRATOR") {
    await alertDetractor(admin, params.token).catch((e) =>
      console.error("[nps.service] alertDetractor", e),
    );
  }

  return { ok: true, category: row.category, message: row.message };
}

/** Fan-out de alerta in-app para MASTER/GESTOR (push é entregue pelo cron de push). */
async function alertDetractor(admin: Admin, token: string): Promise<void> {
  const { data: dispatch } = await admin
    .from("nps_dispatches")
    .select("id, client_id, order_id")
    .eq("token", token)
    .single();
  if (!dispatch) return;

  const [{ data: response }, { data: client }, { data: staff }] = await Promise.all([
    admin.from("nps_responses").select("id, score").eq("dispatch_id", dispatch.id).single(),
    dispatch.client_id
      ? admin.from("clients").select("name").eq("id", dispatch.client_id).single()
      : Promise.resolve({ data: null as { name: string } | null }),
    admin.from("profiles").select("id").in("role", ["MASTER", "GESTOR"]).eq("is_active", true),
  ]);

  const clientName = client?.name ?? "Cliente";
  const score = response?.score ?? null;

  const rows = (staff ?? []).map((u) => ({
    user_id: u.id,
    type: "nps_detractor_alert",
    title: "🔴 Detrator no NPS — tratativa aberta",
    message: `${clientName} deu nota ${score ?? "?"}. Abra a fila de NPS para tratar.`,
    data: {
      nps_response_id: response?.id ?? null,
      client_id: dispatch.client_id,
      order_id: dispatch.order_id,
      score,
    } as Json,
  }));

  if (rows.length) {
    await admin.from("notifications").insert(rows);
  }
}
