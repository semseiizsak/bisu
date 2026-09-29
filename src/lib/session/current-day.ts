import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type DB = SupabaseClient<Database>;

export const PLAN_LENGTH_DAYS = 365;
const TIME_ZONE = "Europe/Budapest";

/** Calendar date (YYYY-MM-DD) of an instant in the learner's time zone. */
export function localDate(instant: Date | string, timeZone: string = TIME_ZONE): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * The reading plan advances by completion, not by the calendar: "today" in
 * the plan is the day after the last completed reading day, so a break never
 * skips ahead. The one exception is the day you just finished: it stays
 * today's day until the calendar actually turns, so finishing shows the
 * "done for today" screen instead of immediately presenting tomorrow's
 * chapters as unread.
 */
export function nextDayIndex(lastCompletedDayIdx: number | null | undefined, lastCompletedAt?: string | null, now: Date = new Date()): number {
  const last = lastCompletedDayIdx ?? 0;
  if (last > 0 && lastCompletedAt && localDate(lastCompletedAt) === localDate(now)) {
    return Math.min(PLAN_LENGTH_DAYS, last);
  }
  return Math.min(PLAN_LENGTH_DAYS, Math.max(1, last + 1));
}

export async function currentDayIndex(db: DB, now: Date = new Date()): Promise<number> {
  const { data } = await db
    .from("reading_log")
    .select("day_idx, completed_at")
    .not("completed_at", "is", null)
    .order("day_idx", { ascending: false })
    .limit(1)
    .maybeSingle();
  return nextDayIndex(data?.day_idx, data?.completed_at, now);
}
