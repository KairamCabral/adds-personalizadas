import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/**
 * Workaround para NavigatorLockAcquireTimeoutError (Supabase auth-js).
 * O lock do Web Locks API pode travar em múltiplas abas ou em certos browsers.
 * Desabilitar o lock evita o timeout que impede o redirecionamento pós-login.
 * @see https://github.com/supabase/supabase-js/issues/936
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: (_acquire: unknown, _release: unknown, fn: () => void) => fn(),
      },
    }
  );
}
