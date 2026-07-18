import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { computeStreak } from "@/lib/streak/compute";

type DB = SupabaseClient<Database>;
type BadgeRow = Database["public"]["Tables"]["badges"]["Row"];

/**
 * Call after a real server-side event (a write, or just a page load — reviews
 * sync offline-first so there's no single write choke point to hook instead).
 * Awards any badge whose metric now clears its threshold, and returns the
 * badges that are earned but not yet shown so the caller can toast them.
 */
export async function checkAndAwardBadges(db: DB): Promise<BadgeRow[]> {
  const [{ data: badges }, streak, bossWinsResult, booksMasteredResult, totalActiveResult, masteredCardsResult, totalReviewsResult] =
    await Promise.all([
      db.from("badges").select("*"),
      computeStreak(db),
      db.from("mastery").select("scope_id", { count: "exact", head: true }).eq("scope_type", "book").not("boss_beaten_at", "is", null),
      db.from("mastery").select("scope_id", { count: "exact", head: true }).eq("scope_type", "book").gte("score", 0.9),
      db.from("cards").select("id", { count: "exact", head: true }).eq("active", true),
      db.from("card_states").select("card_id", { count: "exact", head: true }).gte("state", 2),
      db.from("reviews").select("id", { count: "exact", head: true }),
    ]);

  const totalActive = totalActiveResult.count ?? 0;
  const masteredCards = masteredCardsResult.count ?? 0;
  const coverage = totalActive > 0 ? masteredCards / totalActive : 0;

  const metricValues: Record<string, number> = {
    streak: streak.current,
    boss_wins: bossWinsResult.count ?? 0,
    books_mastered: booksMasteredResult.count ?? 0,
    coverage,
    reviews: totalReviewsResult.count ?? 0,
  };

  const newlyEarnedIds = (badges ?? [])
    .filter((b) => !b.earned_at && (metricValues[b.metric] ?? -Infinity) >= b.threshold)
    .map((b) => b.id);

  if (newlyEarnedIds.length) {
    await db.from("badges").update({ earned_at: new Date().toISOString() }).in("id", newlyEarnedIds);
  }

  const { data: unseen } = await db.from("badges").select("*").not("earned_at", "is", null).is("seen_at", null);
  return unseen ?? [];
}
