import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

type ExpoPushMessage = {
  to: string;
  sound: "default" | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type NotificationPrefs = Record<
  string,
  { in_app?: boolean; email?: boolean; push?: boolean }
>;

async function sendExpoBatch(messages: ExpoPushMessage[]): Promise<void> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Expo Push API error ${response.status}: ${text}`);
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET não configurado - fail-closed");
    return NextResponse.json({ error: "Servidor não configurado" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const { data: notifications, error: notifError } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, message, data")
      .eq("push_sent", false)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (notifError) throw notifError;
    if (!notifications || notifications.length === 0) {
      return NextResponse.json({ success: true, processed: 0, sent: 0, skipped: 0 });
    }

    const userIds = [...new Set(notifications.map((n) => n.user_id))];

    const [tokensResult, prefsResult] = await Promise.all([
      supabase
        .from("push_tokens")
        .select("user_id, token")
        .in("user_id", userIds),
      supabase
        .from("profiles")
        .select("id, notification_preferences")
        .in("id", userIds),
    ]);

    if (tokensResult.error) throw tokensResult.error;
    if (prefsResult.error) throw prefsResult.error;

    const tokensByUser = new Map<string, string[]>();
    for (const row of tokensResult.data ?? []) {
      const list = tokensByUser.get(row.user_id) ?? [];
      list.push(row.token);
      tokensByUser.set(row.user_id, list);
    }

    const prefsByUser = new Map<string, NotificationPrefs>();
    for (const row of prefsResult.data ?? []) {
      prefsByUser.set(row.id, (row.notification_preferences as NotificationPrefs) ?? {});
    }

    const messages: ExpoPushMessage[] = [];
    const notifIdsToMark: string[] = [];

    for (const notif of notifications) {
      processed++;

      const prefs = prefsByUser.get(notif.user_id) ?? {};
      const typePref = prefs[notif.type];
      const pushEnabled = typePref?.push ?? true;

      if (!pushEnabled) {
        skipped++;
        notifIdsToMark.push(notif.id);
        continue;
      }

      const tokens = tokensByUser.get(notif.user_id) ?? [];
      if (tokens.length === 0) {
        skipped++;
        notifIdsToMark.push(notif.id);
        continue;
      }

      for (const token of tokens) {
        if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
          continue;
        }
        messages.push({
          to: token,
          sound: "default",
          title: notif.title,
          body: notif.message ?? notif.title,
          data: (notif.data as Record<string, unknown>) ?? {},
        });
        sent++;
      }

      notifIdsToMark.push(notif.id);
    }

    if (messages.length > 0) {
      try {
        await sendExpoBatch(messages);
      } catch (err) {
        console.error("Expo batch send error:", err);
        errors++;
      }
    }

    if (notifIdsToMark.length > 0) {
      const { error: markError } = await supabase
        .from("notifications")
        .update({ push_sent: true })
        .in("id", notifIdsToMark);

      if (markError) {
        console.error("Error marking push_sent:", markError);
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      sent,
      skipped,
      errors,
    });
  } catch (err) {
    console.error("Push send cron error:", err);
    return NextResponse.json(
      { error: "Erro ao enviar push notifications" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
