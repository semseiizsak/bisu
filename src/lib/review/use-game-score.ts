import { useCallback, useRef } from "react";
import { reviewCard, type FsrsRating, type PersistedCardState } from "@/lib/fsrs/engine";
import { queuePendingReview } from "@/lib/db/sync";

/** Shared FSRS-write helper for game modes — every game answer counts as a real review. */
export function useGameScore(mode: string) {
  const startedAt = useRef(Date.now());

  const markStart = useCallback(() => {
    startedAt.current = Date.now();
  }, []);

  const submit = useCallback(
    async (cardId: number, state: PersistedCardState, rating: FsrsRating) => {
      const durationMs = Date.now() - startedAt.current;
      const { next, elapsedDays } = reviewCard(state, rating, new Date());
      await queuePendingReview({
        card_id: cardId,
        rating,
        state_before: state.state,
        elapsed_days: elapsedDays,
        duration_ms: durationMs,
        mode,
        reviewed_at: new Date().toISOString(),
        new_stability: next.stability ?? 0,
        new_difficulty: next.difficulty ?? 0,
        new_due_at: next.due_at ?? new Date().toISOString(),
        new_state: next.state,
        new_reps: next.reps,
        new_lapses: next.lapses,
      });
      startedAt.current = Date.now();
    },
    [mode],
  );

  return { markStart, submit };
}
