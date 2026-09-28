"use server";

import { createClient } from "@/lib/supabase/server";
import { currentDayIndex } from "@/lib/session/current-day";
import { ensureDailyQuests } from "@/lib/quests/progress";

/** Villámkör is display-only (no per-answer FSRS writes) — a perfect run is
 * the one quest metric that has to be reported by the client instead of
 * derived from `reviews`. Best-effort: a failed/offline call just means the
 * quest (if it was in today's rotation) stays incomplete until re-earned. */
export async function recordBlitzResult(hits: number, total: number): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || total <= 0 || hits < total) return;

  const dayIdx = await currentDayIndex(supabase);

  await ensureDailyQuests(supabase, dayIdx);
  const { data: quest } = await supabase
    .from("daily_quests")
    .select("*")
    .eq("day_idx", dayIdx)
    .eq("quest_key", "blitz_perfect")
    .maybeSingle();
  if (!quest || quest.completed_at) return;

  const now = new Date().toISOString();
  await supabase.from("daily_quests").update({ progress: quest.target, completed_at: now }).eq("day_idx", dayIdx).eq("quest_key", "blitz_perfect");
  await supabase
    .from("xp_events")
    .upsert({ ref: `blitz:${now.slice(0, 10)}`, kind: "blitz", amount: quest.xp }, { onConflict: "ref" });
}
