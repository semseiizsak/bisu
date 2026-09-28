"use server";

import { createClient } from "@/lib/supabase/server";
import { checkAndAwardBadges } from "@/lib/badges/check";
import { loadGameQuestions } from "@/lib/games/question-pool";

export async function getBossCards(bookId: number) {
  const supabase = await createClient();
  return loadGameQuestions(supabase, { bookId, count: 40 });
}

export async function applyBossBonus(bookSlug: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("mastery")
    .select("score")
    .eq("scope_type", "book")
    .eq("scope_id", bookSlug)
    .maybeSingle();

  const newScore = Math.min(1, (existing?.score ?? 0) + 0.05);
  const { error } = await supabase.from("mastery").upsert({
    scope_type: "book",
    scope_id: bookSlug,
    score: newScore,
    updated_at: new Date().toISOString(),
    boss_beaten_at: new Date().toISOString(),
  });
  if (error) throw error;

  return checkAndAwardBadges(supabase);
}
