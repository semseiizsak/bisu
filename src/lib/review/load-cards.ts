import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ReviewCard } from "@/lib/review/types";
import type { CardType } from "@/lib/content/difficulty";
import { createNewCardState } from "@/lib/fsrs/engine";

export async function loadReviewCards(
  db: SupabaseClient<Database>,
  cardIds: number[],
): Promise<ReviewCard[]> {
  if (!cardIds.length) return [];

  const [{ data: cards }, { data: states }] = await Promise.all([
    db.from("cards").select("id, type, prompt, answer, answer_alt, distractors, payload, verse_ref, entity_id").in("id", cardIds),
    db.from("card_states").select("card_id, stability, difficulty, due_at, last_review, reps, lapses, state").in("card_id", cardIds),
  ]);

  const stateByCard = new Map((states ?? []).map((s) => [s.card_id, s]));
  const order = new Map(cardIds.map((id, i) => [id, i]));

  return (cards ?? [])
    .map((c) => {
      const s = stateByCard.get(c.id);
      return {
        id: c.id,
        type: c.type as CardType,
        prompt: c.prompt,
        answer: c.answer,
        answer_alt: c.answer_alt ?? [],
        distractors: c.distractors ?? [],
        payload: (c.payload as Record<string, unknown>) ?? null,
        verse_ref: c.verse_ref,
        entity_id: c.entity_id,
        state: s
          ? {
              stability: s.stability,
              difficulty: s.difficulty,
              due_at: s.due_at,
              last_review: s.last_review,
              reps: s.reps,
              lapses: s.lapses,
              state: s.state,
            }
          : createNewCardState(),
      };
    })
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
