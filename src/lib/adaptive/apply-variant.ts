import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type { Database } from "@/lib/supabase/types";
import type { CardType } from "@/lib/content/difficulty";
import { nextVariantType, isEasyStreak } from "@/lib/adaptive/variant";
import { buildVariantCard } from "@/lib/adaptive/generate-variant";
import { polishBatch, type PolishItem } from "@/lib/adaptive/polish-prompt";

type DB = SupabaseClient<Database>;

const POLISHABLE_TYPES = new Set<CardType>(["recall", "reverse", "numeric", "mcq"]);

/**
 * Call after every review submission. If this card just hit 3 consecutive
 * Easy ratings, reformulates the underlying fact into the next card type
 * (section 10.1) and hands the FSRS state over unchanged — the learner
 * keeps their progress, only the question's shape changes.
 */
export async function maybeCreateVariant(db: DB, cardId: number): Promise<void> {
  const { data: card } = await db.from("cards").select("id, type, fact_id, tags").eq("id", cardId).maybeSingle();
  if (!card || card.fact_id == null) return;

  const { data: recentReviews } = await db
    .from("reviews")
    .select("rating")
    .eq("card_id", cardId)
    .order("reviewed_at", { ascending: false })
    .limit(3);
  if (!isEasyStreak((recentReviews ?? []).map((r) => r.rating))) return;

  const nextType = nextVariantType(card.type as CardType);
  if (!nextType) return;

  const draft = await buildVariantCard(db, card.fact_id, nextType);
  if (!draft) return;

  const { data: originalState } = await db
    .from("card_states")
    .select("stability, difficulty, due_at, last_review, reps, lapses, state")
    .eq("card_id", cardId)
    .maybeSingle();
  if (!originalState) return;

  let polishedPrompt: string | null = null;
  if (POLISHABLE_TYPES.has(draft.type) && process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const item: PolishItem = {
        cardId: 0, // placeholder id — this is a single-item batch, never persisted
        cardType: draft.type as PolishItem["cardType"],
        entityName: draft.entityName,
        entityType: draft.entityType,
        factKey: draft.factKey,
        factValue: draft.factValue,
        unit: draft.unit,
        isContrast: false,
        answer: draft.answer,
        answerAlt: draft.answer_alt,
      };
      const resultMap = await polishBatch(openai, [item]);
      polishedPrompt = resultMap.get(0) ?? null;
    } catch {
      // AI polish is a nice-to-have — fall back to the raw template below
    }
  }

  const { data: newCard, error: insertError } = await db
    .from("cards")
    .insert({
      type: draft.type,
      prompt: polishedPrompt ?? draft.prompt,
      prompt_raw: draft.prompt,
      prompt_polished_at: polishedPrompt ? new Date().toISOString() : null,
      answer: draft.answer,
      answer_alt: draft.answer_alt,
      distractors: draft.distractors,
      payload: draft.payload as Record<string, unknown> | null,
      fact_id: draft.fact_id,
      entity_id: draft.entity_id,
      book_id: draft.book_id,
      chapter: draft.chapter,
      verse_ref: draft.verse_ref,
      difficulty: draft.difficulty,
      variant_of: cardId,
      source: "runtime",
      active: true,
    })
    .select("id")
    .single();
  if (insertError || !newCard) return;

  await db.from("card_states").insert({
    card_id: newCard.id,
    stability: originalState.stability,
    difficulty: originalState.difficulty,
    due_at: originalState.due_at,
    last_review: originalState.last_review,
    reps: originalState.reps,
    lapses: originalState.lapses,
    state: originalState.state,
    suspended: false,
  });

  await db.from("cards").update({ active: false }).eq("id", cardId);
  await db.from("card_states").update({ suspended: true }).eq("card_id", cardId);
}
