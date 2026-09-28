import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Single-user app with no login: every page, server action and route
 * handler talks to Supabase through the service role key, server-side
 * only. The browser never holds a Supabase key at all; RLS stays enabled
 * on every table so the anon key (if it leaks) can do nothing.
 *
 * Kept async and under the old name so the many call sites read the same.
 */
export async function createClient() {
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
