import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTinyConnected } from "@/lib/tiny-api";

export async function GET() {
  // ═══ AUTH CHECK ═══
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const [tiny, resend] = await Promise.all([
    isTinyConnected().catch(() => false),
    Promise.resolve(!!process.env.RESEND_API_KEY),
  ]);

  return NextResponse.json({ tiny, resend });
}
