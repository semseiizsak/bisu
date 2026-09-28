import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { QUEST_CATALOG, questsForDay, type QuestDef, type QuestMetric } from "@/lib/quests/catalog";

type DB = SupabaseClient<Database>;
type DailyQuestRow = Database["public"]["Tables"]["daily_quests"]["Row"];

/** Insert-if-missing today's 3 quests. Safe to call repeatedly. */
export async function ensureDailyQuests(db: DB, dayIdx: number): Promise<void> {
  const quests = questsForDay(dayIdx);
  const rows = quests.map((q) => ({
    day_idx: dayIdx,
    quest_key: q.key,
    label_hu: q.label(q.target),
    target: q.target,
    xp: q.xp,
  }));
  await db.from("daily_quests").upsert(rows, { onConflict: "day_idx,quest_key", ignoreDuplicates: true });
}

interface MetricResult {
  progress: number;
  done: boolean;
}

async function computeMetric(db: DB, metric: QuestMetric, dayIdx: number, todayStartIso: string, target: number): Promise<MetricResult> {
  switch (metric) {
    case "srs_count": {
      const { count } = await db.from("reviews").select("id", { count: "exact", head: true }).eq("mode", "srs").gte("reviewed_at", todayStartIso);
      const n = count ?? 0;
      return { progress: Math.min(n, target), done: n >= target };
    }
    case "correct_count": {
      const { count } = await db
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("mode", "srs")
        .gte("rating", 3)
        .gte("reviewed_at", todayStartIso);
      const n = count ?? 0;
      return { progress: Math.min(n, target), done: n >= target };
    }
    case "new_cards": {
      // A card's first-ever review (state_before = 0) in the quiz.
      const { count } = await db
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("mode", "srs")
        .eq("state_before", 0)
        .gte("reviewed_at", todayStartIso);
      const n = count ?? 0;
      return { progress: Math.min(n, target), done: n >= target };
    }
    case "reading_done": {
      const { data } = await db.from("reading_log").select("completed_at").eq("day_idx", dayIdx).maybeSingle();
      const done = !!data?.completed_at;
      return { progress: done ? 1 : 0, done };
    }
    case "game_played": {
      const { count } = await db.from("reviews").select("id", { count: "exact", head: true }).like("mode", "game:%").gte("reviewed_at", todayStartIso);
      const done = (count ?? 0) > 0;
      return { progress: done ? 1 : 0, done };
    }
    case "accuracy_80": {
      const { data } = await db.from("reviews").select("rating").eq("mode", "srs").gte("reviewed_at", todayStartIso);
      const rows = data ?? [];
      const progress = Math.min(rows.length, target);
      const correct = rows.filter((r) => r.rating >= 3).length;
      const done = rows.length >= target && correct / rows.length >= 0.8;
      return { progress, done };
    }
    case "blitz_perfect":
      // Client-sourced only — src/lib/actions/blitz-result.ts writes this quest directly.
      return { progress: 0, done: false };
  }
}

/**
 * Recomputes progress for every not-yet-completed quest today (server-derived,
 * same "safe to call on every load" pattern as checkAndAwardBadges), awards
 * quest XP on completion, and returns the completed-but-unseen quests so the
 * caller can toast them.
 */
export async function updateQuestProgress(db: DB, dayIdx: number, now: Date = new Date()): Promise<DailyQuestRow[]> {
  await ensureDailyQuests(db, dayIdx);

  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  const { data: quests } = await db.from("daily_quests").select("*").eq("day_idx", dayIdx);
  const rows = quests ?? [];

  // The three quests are independent — evaluate and write them in parallel.
  await Promise.all(
    rows.map(async (row) => {
      if (row.completed_at) return;
      const def: QuestDef | undefined = QUEST_CATALOG.find((q) => q.key === row.quest_key);
      if (!def || def.metric === "blitz_perfect") return;

      const { progress, done } = await computeMetric(db, def.metric, dayIdx, todayStartIso, row.target);
      if (progress === row.progress && !done) return; // nothing changed, skip the write
      const patch: { progress: number; completed_at?: string } = { progress };
      if (done) patch.completed_at = now.toISOString();

      await Promise.all([
        db.from("daily_quests").update(patch).eq("day_idx", dayIdx).eq("quest_key", row.quest_key),
        done
          ? db.from("xp_events").upsert({ ref: `quest:${dayIdx}:${row.quest_key}`, kind: "quest", amount: row.xp }, { onConflict: "ref" })
          : Promise.resolve(),
      ]);
    }),
  );

  const { data: unseen } = await db
    .from("daily_quests")
    .select("*")
    .eq("day_idx", dayIdx)
    .not("completed_at", "is", null)
    .is("seen_at", null);
  return unseen ?? [];
}

export async function fetchDailyQuests(db: DB, dayIdx: number): Promise<DailyQuestRow[]> {
  const { data } = await db.from("daily_quests").select("*").eq("day_idx", dayIdx).order("quest_key");
  return data ?? [];
}
