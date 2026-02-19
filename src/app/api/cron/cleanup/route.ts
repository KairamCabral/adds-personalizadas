import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verificação básica para Vercel Cron (CRON_SECRET)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoff = ninetyDaysAgo.toISOString();

  let tokensDeleted = 0;
  let notificationsDeleted = 0;

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

    return NextResponse.json({
      success: true,
      deleted: {
        approval_tokens: tokensDeleted,
        notifications: notificationsDeleted,
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
