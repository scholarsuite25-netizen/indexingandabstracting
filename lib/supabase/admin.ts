import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The service-role client, for server code only (currently the email actions).
 *
 * It bypasses row-level security, so it is never imported by a component or any file
 * that reaches the browser: `server-only` makes that a build error rather than a
 * mistake somebody has to notice. Every action that uses it still checks the caller
 * first and returns nothing but "sent / not sent".
 */
export function createAdminSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
