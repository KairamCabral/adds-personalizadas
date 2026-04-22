import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeCompare } from "@/lib/crypto-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET não configurado - fail-closed");
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization") ?? "";
  if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoff = ninetyDaysAgo.toISOString();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysCutoff = sevenDaysAgo.toISOString();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysCutoff = thirtyDaysAgo.toISOString();

  let tokensDeleted = 0;
  let notificationsDeleted = 0;
  let notificationsAutoMarked = 0;
  let trashedOrdersPurged = 0;

  try {
    const { data: expiredTokens, error: tokensError } = await supabase
      .from("approval_tokens")
      .delete()
      .lt("expires_at", now)
      .select("id");

    if (!tokensError && expiredTokens) {
      tokensDeleted = expiredTokens.length;
    } else if (tokensError) {
      console.error("Cleanup approval_tokens error:", tokensError);
    }

    const { data: oldNotifications, error: notifError } = await supabase
      .from("notifications")
      .delete()
      .lt("created_at", cutoff)
      .select("id");

    if (!notifError && oldNotifications) {
      notificationsDeleted = oldNotifications.length;
    } else if (notifError) {
      console.error("Cleanup notifications error:", notifError);
    }

    // Auto-marcar notificações não lidas com mais de 7 dias como lidas
    const { data: autoMarked, error: autoMarkError } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .is("read_at", null)
      .lt("created_at", sevenDaysCutoff)
      .select("id");

    if (!autoMarkError && autoMarked) {
      notificationsAutoMarked = autoMarked.length;
    } else if (autoMarkError) {
      console.error("Cleanup auto-mark notifications error:", autoMarkError);
    }

    // Purge permanente de pedidos na lixeira há mais de 30 dias
    const { data: purgedOrders, error: purgeError } = await supabase
      .from("orders")
      .delete()
      .not("deleted_at", "is", null)
      .lt("deleted_at", thirtyDaysCutoff)
      .select("id, order_number");

    if (!purgeError && purgedOrders) {
      trashedOrdersPurged = purgedOrders.length;
      if (trashedOrdersPurged > 0) {
        console.log(
          `[cron:cleanup] Purged ${trashedOrdersPurged} trashed order(s):`,
          purgedOrders.map((o) => `#${o.order_number ?? o.id}`)
        );
      }
    } else if (purgeError) {
      console.error("[cron:cleanup] Purge trashed orders error:", purgeError);
    }

    return NextResponse.json({
      success: true,
      deleted: {
        approval_tokens: tokensDeleted,
        notifications: notificationsDeleted,
        trashed_orders: trashedOrdersPurged,
      },
      auto_marked: {
        notifications: notificationsAutoMarked,
      },
    });
  } catch (err) {
    console.error("Cleanup cron error:", err);
    return NextResponse.json(
      { error: "Erro ao executar limpeza" },
      { status: 500 }
    );
  }
}
