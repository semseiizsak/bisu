import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type DB = SupabaseClient<Database>;

export interface StreakResult {
  current: number;
  longest: number;
}

const DAY_MS = 86_400_000;

/** Pure streak arithmetic over a set of YYYY-MM-DD activity days. */
export function streakFromDays(days: Set<string>, now: Date = new Date()): StreakResult {
  if (days.size === 0) return { current: 0, longest: 0 };

  const sorted = Array.from(days).sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diffDays = Math.round((Date.parse(sorted[i] + "T00:00:00Z") - Date.parse(sorted[i - 1] + "T00:00:00Z")) / DAY_MS);
    run = diffDays === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = new Date(now.getTime() - DAY_MS).toISOString().slice(0, 10);
  const anchor = days.has(todayStr) ? todayStr : days.has(yesterdayStr) ? yesterdayStr : null;

  let current = 0;
  if (anchor) {
    current = 1;
    let cursor = Date.parse(anchor + "T00:00:00Z");
    while (true) {
      const prevDay = new Date(cursor - DAY_MS).toISOString().slice(0, 10);
      if (!days.has(prevDay)) break;
      current += 1;
      cursor -= DAY_MS;
    }
  }

  return { current, longest };
}

/**
 * A day counts as "kept" if a review or a completed reading happened on it —
 * deliberately permissive so the streak rewards showing up at all.
 *
 * Uses the activity_days() SQL function (migration 0014): one small result
 * instead of every review row ever written. Falls back to the row scan if
 * the function isn't installed yet.
 */
export async function computeStreak(db: DB, now: Date = new Date()): Promise<StreakResult> {
  const { data: rpcDays, error } = await db.rpc("activity_days");
  if (!error && rpcDays) {
    return streakFromDays(new Set(rpcDays.map((d) => String(d).slice(0, 10))), now);
  }

  const [{ data: reviewRows }, { data: readingRows }] = await Promise.all([
    db.from("reviews").select("reviewed_at").order("reviewed_at", { ascending: false }).limit(1000),
    db.from("reading_log").select("completed_at").not("completed_at", "is", null),
  ]);
  const days = new Set<string>();
  for (const r of reviewRows ?? []) days.add(r.reviewed_at.slice(0, 10));
  for (const r of readingRows ?? []) if (r.completed_at) days.add(r.completed_at.slice(0, 10));
  return streakFromDays(days, now);
}
