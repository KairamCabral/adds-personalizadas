// WARNING: This module uses SUPABASE_SERVICE_ROLE_KEY and MUST only be imported
// from server-side code (API routes, Server Components, Server Actions).
// Do NOT import from Client Components. The key itself is not NEXT_PUBLIC_* so
// Next.js won't bundle it, but structural isolation is still recommended.
// TODO: Refactor agreements.service.ts to not import this in client tree (Story 3).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// ⚠️ NEVER expose this client on the client-side
// Use only in API routes and server actions
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
