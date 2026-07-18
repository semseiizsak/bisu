"use server";

import { createClient } from "@/lib/supabase/server";

export async function getBossCards(bookId: number) {
  const supabase = await createClient();
  const { data: cards } = await supabase
    .from("cards")
    .select("id, prompt, answer, payload")
    .eq("book_id", bookId)
    .eq("type", "mcq")
    .eq("active", true)
    .limit(200);

  const pool = [...(cards ?? [])].sort(() => Math.random() - 0.5).slice(0, 40);
  const { data: states } = pool.length
    ? await supabase
        .from("card_states")
        .select("card_id, stability, difficulty, due_at, last_review, reps, lapses, state")
        .in("card_id", pool.map((c) => c.id))
    : { data: [] };
  const stateByCard = new Map((states ?? []).map((s) => [s.card_id, s]));

  return pool.map((c) => ({
    id: c.id,
    prompt: c.prompt,
    answer: c.answer,
    options: (c.payload as { options: string[] } | null)?.options ?? [],
    state: stateByCard.get(c.id) ?? { stability: null, difficulty: null, due_at: null, last_review: null, reps: 0, lapses: 0, state: 0 },
  }));
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
  const { error } = await supabase
    .from("mastery")
    .upsert({ scope_type: "book", scope_id: bookSlug, score: newScore, updated_at: new Date().toISOString() });
  if (error) throw error;
}
