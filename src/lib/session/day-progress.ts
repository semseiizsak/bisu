import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SessionPlan } from "@/lib/session/types";
import { DEFAULT_TIME_ESTIMATES } from "@/lib/session/time-estimates";
import { DAILY_QUIZ_CAP } from "@/lib/session/constants";

type DB = SupabaseClient<Database>;

export interface DayProgress {
  /** 0..1 fractions for the day ring. */
  reading: number;
  srs: number;
  game: number;
  /** Raw counts for the /ma checklist — "what have I done, what's left". */
  hasReading: boolean;
  srsDone: number;
  /** Capped at DAILY_QUIZ_CAP: a "complete day" means finishing the capped
   * quiz, not every theoretically-eligible card in the plan. */
  srsExpected: number;
  gameDone: number;
  gameExpected: number;
}

const SRS_BLOCK_TYPES = ["review", "new", "weak", "interleave"];

const CARD_MINUTE_VALUES = Object.values(DEFAULT_TIME_ESTIMATES.card);
const AVG_CARD_MINUTES = CARD_MINUTE_VALUES.reduce((a, b) => a + b, 0) / CARD_MINUTE_VALUES.length;

export async function computeDayProgress(db: DB, plan: SessionPlan, now: Date = new Date()): Promise<DayProgress> {
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  const readingBlock = plan.blocks.find((b) => b.type === "reading");
  const srsPlanned = plan.blocks.filter((b) => SRS_BLOCK_TYPES.includes(b.type)).reduce((s, b) => s + b.items.length, 0);
  const srsExpected = Math.min(DAILY_QUIZ_CAP, srsPlanned);
  const gameBlock = plan.blocks.find((b) => b.type === "game");
  const gameExpected = gameBlock ? Math.max(3, Math.round(gameBlock.est_minutes / AVG_CARD_MINUTES)) : 0;

  const [readingResult, srsResult, gameResult] = await Promise.all([
    readingBlock && plan.day_idx != null
      ? db.from("reading_log").select("completed_at").eq("day_idx", plan.day_idx).maybeSingle()
      : Promise.resolve(null),
    db.from("reviews").select("id", { count: "exact", head: true }).eq("mode", "srs").gte("reviewed_at", todayStartIso),
    db.from("reviews").select("id", { count: "exact", head: true }).like("mode", "game:%").gte("reviewed_at", todayStartIso),
  ]);

  const srsDone = srsResult.count ?? 0;
  const gameDone = gameResult.count ?? 0;

  return {
    reading: readingBlock ? (readingResult?.data?.completed_at ? 1 : 0) : 1,
    srs: srsExpected > 0 ? Math.min(1, srsDone / srsExpected) : 1,
    game: gameExpected > 0 ? Math.min(1, gameDone / gameExpected) : 1,
    hasReading: !!readingBlock,
    srsDone,
    srsExpected,
    gameDone,
    gameExpected,
  };
}
