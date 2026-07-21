import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { XP, levelForXp } from "@/lib/xp/constants";

type DB = SupabaseClient<Database>;

export interface XpSummary {
  totalXp: number;
  level: number;
  todayXp: number;
}

async function upsertXp(db: DB, ref: string, kind: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  await db.from("xp_events").upsert({ ref, kind, amount }, { onConflict: "ref" });
}

/**
 * Recomputes today's XP from already-synced data (reviews/reading_log) and
 * upserts idempotent ledger rows keyed by a deterministic `ref` — safe to
 * call on every /ma or /haladas load. Nothing is ever client-incremented,
 * so an offline session can't double- or under-count XP; a recompute just
 * overwrites the row's `amount` in place.
 */
export async function reconcileXp(db: DB, dayIdx: number | null, now: Date = new Date()): Promise<XpSummary> {
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();
  const dateKey = now.toISOString().slice(0, 10);

  const [correctResult, gameResult, readingResult] = await Promise.all([
    db.from("reviews").select("id", { count: "exact", head: true }).eq("mode", "srs").gte("rating", 3).gte("reviewed_at", todayStartIso),
    db.from("reviews").select("id", { count: "exact", head: true }).like("mode", "game:%").gte("reviewed_at", todayStartIso),
    dayIdx != null
      ? db.from("reading_log").select("completed_at").eq("day_idx", dayIdx).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  await Promise.all([
    upsertXp(db, `cards:${dateKey}`, "cards", (correctResult.count ?? 0) * XP.CORRECT_CARD),
    upsertXp(db, `game:${dateKey}`, "game", (gameResult.count ?? 0) > 0 ? XP.GAME : 0),
    dayIdx != null && readingResult.data?.completed_at
      ? upsertXp(db, `reading:${dayIdx}`, "reading", XP.READING)
      : Promise.resolve(),
  ]);

  const { data: events } = await db.from("xp_events").select("amount, created_at");
  const rows = events ?? [];
  const totalXp = rows.reduce((s, e) => s + e.amount, 0);
  const todayXp = rows.filter((e) => e.created_at >= todayStartIso).reduce((s, e) => s + e.amount, 0);

  return { totalXp, level: levelForXp(totalXp), todayXp };
}
