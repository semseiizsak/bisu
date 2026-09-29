import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { localDate } from "@/lib/session/current-day";

type DB = SupabaseClient<Database>;

/**
 * The day's quiz target is fixed the first time a session is opened that
 * day. Without this, finishing the session made the planner offer the next
 * batch of new cards and the checklist said "not done" no matter how much
 * you did. Extra rounds add to the count but never move the goalposts.
 */
export async function recordSessionTarget(db: DB, count: number, now: Date = new Date()): Promise<number> {
  const date = localDate(now);
  const existing = await getSessionTarget(db, now);
  if (existing != null) return existing;
  await db.from("daily_sessions").upsert({ date, plan: { srs_target: count } }, { onConflict: "date", ignoreDuplicates: true });
  return count;
}

export async function getSessionTarget(db: DB, now: Date = new Date()): Promise<number | null> {
  const { data } = await db.from("daily_sessions").select("plan").eq("date", localDate(now)).maybeSingle();
  const target = (data?.plan as { srs_target?: unknown } | null)?.srs_target;
  return typeof target === "number" ? target : null;
}
