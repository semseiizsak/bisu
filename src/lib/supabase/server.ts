import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Single-user app with no login: every page, server action and route
 * handler talks to Supabase through the service role key, server-side
 * only. The browser never holds a Supabase key at all; RLS stays enabled
 * on every table so the anon key (if it leaks) can do nothing.
 *
 * The app's tables live in their own schema ("bisu") because the Supabase
 * project is shared with other apps. SUPABASE_SCHEMA overrides it.
 */
export const SUPABASE_SCHEMA = (process.env.SUPABASE_SCHEMA?.trim() || "bisu") as "bisu";

/** The URL is only ever read on the server, so a non-public name is fine;
 * the first one set wins (NEXT_PUBLIC_SUPABASE_URL is kept last for old
 * deployments that still carry it). */
export function supabaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.NEXT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing SUPABASE_URL / NEXT_SUPABASE_URL");
  return url;
}

export async function createClient() {
  return createSupabaseClient<Database>(supabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    db: { schema: SUPABASE_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
