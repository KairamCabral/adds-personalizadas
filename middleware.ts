import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     * - api/tiny/webhook (webhook público do Tiny — não pode ter sessão)
     * - api/webhooks (webhooks públicos legados)
     * - api/cron (jobs agendados)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/tiny/webhook|api/webhooks|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
