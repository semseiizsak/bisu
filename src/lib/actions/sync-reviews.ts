"use server";

import { createClient } from "@/lib/supabase/server";

export interface ReviewPayload {
  card_id: number;
  rating: number;
  state_before: number | null;
  elapsed_days: number | null;
  duration_ms: number;
  mode: string;
  reviewed_at: string;
  new_stability: number;
  new_difficulty: number;
  new_due_at: string;
  new_state: number;
  new_reps: number;
  new_lapses: number;
}

/**
 * Persists one queued review (the offline queue in src/lib/db/sync.ts
 * drains through here). Server-side because the browser holds no Supabase
 * key. `suspended` is deliberately not touched so a retired card's state
 * isn't un-retired by a late review write.
 */
export async function pushReview(review: ReviewPayload): Promise<void> {
  const supabase = await createClient();

  const { error: reviewError } = await supabase.from("reviews").insert({
    card_id: review.card_id,
    rating: review.rating,
    state_before: review.state_before,
    elapsed_days: review.elapsed_days,
    duration_ms: review.duration_ms,
    mode: review.mode,
    reviewed_at: review.reviewed_at,
  });
  if (reviewError) throw reviewError;

  const { error: stateError } = await supabase.from("card_states").upsert({
    card_id: review.card_id,
    stability: review.new_stability,
    difficulty: review.new_difficulty,
    due_at: review.new_due_at,
    last_review: review.reviewed_at,
    reps: review.new_reps,
    lapses: review.new_lapses,
    state: review.new_state,
  });
  if (stateError) throw stateError;
}
