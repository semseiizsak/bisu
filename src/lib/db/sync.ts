import { db, type LocalCard, type PendingReview } from "@/lib/db/dexie";
import { createClient } from "@/lib/supabase/client";

export async function cacheCardsForOffline(cards: LocalCard[]): Promise<void> {
  await db.cards.bulkPut(cards);
}

export async function queuePendingReview(review: Omit<PendingReview, "local_id" | "synced">): Promise<void> {
  await db.pending_reviews.add({ ...review, synced: 0 });
  await db.card_states.put({
    card_id: review.card_id,
    stability: review.new_stability,
    difficulty: review.new_difficulty,
    due_at: review.new_due_at,
    last_review: review.reviewed_at,
    reps: review.new_reps,
    lapses: review.new_lapses,
    state: review.new_state,
    suspended: false,
  });
  void flushPendingReviews();
}

let flushing = false;

/** Pushes queued offline reviews to Supabase. Safe to call repeatedly — no-ops while offline or already running. */
export async function flushPendingReviews(): Promise<{ pushed: number; failed: number }> {
  if (flushing) return { pushed: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { pushed: 0, failed: 0 };
  flushing = true;
  let pushed = 0;
  let failed = 0;

  try {
    const supabase = createClient();
    const pending = await db.pending_reviews.where("synced").equals(0).toArray();

    for (const review of pending) {
      try {
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
          suspended: false,
        });
        if (stateError) throw stateError;

        if (review.local_id != null) {
          await db.pending_reviews.update(review.local_id, { synced: 1 });
        }
        pushed++;
      } catch {
        failed++;
      }
    }

    if (pushed > 0) {
      await db.pending_reviews.where("synced").equals(1).delete();
    }
  } finally {
    flushing = false;
  }

  return { pushed, failed };
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flushPendingReviews());
}
