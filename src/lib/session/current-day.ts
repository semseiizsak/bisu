import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type DB = SupabaseClient<Database>;

export const PLAN_LENGTH_DAYS = 365;

/**
 * The reading plan advances by completion, not by the calendar. The old
 * `program_start_date` arithmetic meant that after a two-week break the app
 * silently jumped fourteen days ahead in the plan; coming back after a long
 * absence put the learner deep into books they had never read. Now "today"
 * in the plan is simply the day after the last completed reading day.
 */
export function nextDayIndex(lastCompletedDayIdx: number | null | undefined): number {
  const last = lastCompletedDayIdx ?? 0;
  return Math.min(PLAN_LENGTH_DAYS, Math.max(1, last + 1));
}

export async function currentDayIndex(db: DB): Promise<number> {
  const { data } = await db
    .from("reading_log")
    .select("day_idx")
    .not("completed_at", "is", null)
    .order("day_idx", { ascending: false })
    .limit(1)
    .maybeSingle();
  return nextDayIndex(data?.day_idx);
}
