import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SessionPlan } from "@/lib/session/types";
import { DEFAULT_TIME_ESTIMATES } from "@/lib/session/time-estimates";

type DB = SupabaseClient<Database>;

export interface DayProgress {
  reading: number;
  srs: number;
  game: number;
}

const SRS_BLOCK_TYPES = ["review", "new", "weak", "interleave"];

const CARD_MINUTE_VALUES = Object.values(DEFAULT_TIME_ESTIMATES.card);
const AVG_CARD_MINUTES = CARD_MINUTE_VALUES.reduce((a, b) => a + b, 0) / CARD_MINUTE_VALUES.length;

export async function computeDayProgress(db: DB, plan: SessionPlan, now: Date = new Date()): Promise<DayProgress> {
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  const readingBlock = plan.blocks.find((b) => b.type === "reading");
  const srsExpected = plan.blocks.filter((b) => SRS_BLOCK_TYPES.includes(b.type)).reduce((s, b) => s + b.items.length, 0);
  const gameBlock = plan.blocks.find((b) => b.type === "game");
  const expectedGameCards = gameBlock ? Math.max(3, Math.round(gameBlock.est_minutes / AVG_CARD_MINUTES)) : 0;

  const [readingResult, srsResult, gameResult] = await Promise.all([
    readingBlock && plan.day_idx != null
      ? db.from("reading_log").select("completed_at").eq("day_idx", plan.day_idx).maybeSingle()
      : Promise.resolve(null),
    db.from("reviews").select("id", { count: "exact", head: true }).eq("mode", "srs").gte("reviewed_at", todayStartIso),
    db.from("reviews").select("id", { count: "exact", head: true }).like("mode", "game:%").gte("reviewed_at", todayStartIso),
  ]);

  const reading = readingBlock ? (readingResult?.data?.completed_at ? 1 : 0) : 1;
  const srs = srsExpected > 0 ? Math.min(1, (srsResult.count ?? 0) / srsExpected) : 1;
  const game = expectedGameCards > 0 ? Math.min(1, (gameResult.count ?? 0) / expectedGameCards) : 1;

  return { reading, srs, game };
}
