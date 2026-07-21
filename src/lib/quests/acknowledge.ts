"use server";

import { createClient } from "@/lib/supabase/server";

export async function acknowledgeQuests(dayIdx: number, questKeys: string[]) {
  if (!questKeys.length) return;
  const supabase = await createClient();
  await supabase.from("daily_quests").update({ seen_at: new Date().toISOString() }).eq("day_idx", dayIdx).in("quest_key", questKeys);
}
