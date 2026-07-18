import { fsrs, generatorParameters, Rating, State, type Card, type Grade } from "ts-fsrs";

export { Rating, State };
export type FsrsRating = 1 | 2 | 3 | 4; // Again | Hard | Good | Easy

const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: 365 * 2,
    enable_fuzz: true,
  }),
);

export interface PersistedCardState {
  stability: number | null;
  difficulty: number | null;
  due_at: string | null;
  last_review: string | null;
  reps: number;
  lapses: number;
  state: number;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((a.getTime() - b.getTime()) / 86_400_000));
}

/**
 * Reconstructs a ts-fsrs Card from the columns we persist. `learning_steps`
 * and the deprecated `elapsed_days`/`scheduled_days` fields aren't stored
 * (out of scope of the handoff's card_states schema) — scheduling for
 * Review-state cards depends on stability/difficulty/last_review, not on
 * those, so this is a safe simplification for a single-user app.
 */
function toFsrsCard(state: PersistedCardState): Card {
  const lastReview = state.last_review ? new Date(state.last_review) : undefined;
  const due = state.due_at ? new Date(state.due_at) : new Date();
  return {
    due,
    stability: state.stability ?? 0,
    difficulty: state.difficulty ?? 0,
    elapsed_days: lastReview ? daysBetween(due, lastReview) : 0,
    scheduled_days: lastReview ? daysBetween(due, lastReview) : 0,
    learning_steps: 0,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state as State,
    last_review: lastReview,
  };
}

export function createNewCardState(): PersistedCardState {
  return {
    stability: null,
    difficulty: null,
    due_at: new Date().toISOString(),
    last_review: null,
    reps: 0,
    lapses: 0,
    state: State.New,
  };
}

/** Applies a review rating to a persisted card state and returns the new state. */
export function reviewCard(
  current: PersistedCardState,
  rating: FsrsRating,
  now: Date = new Date(),
): { next: PersistedCardState; elapsedDays: number } {
  const card = toFsrsCard(current);
  const elapsedDays = current.last_review ? daysBetween(now, new Date(current.last_review)) : 0;
  const { card: nextCard } = scheduler.next(card, now, rating as Grade);

  return {
    next: {
      stability: nextCard.stability,
      difficulty: nextCard.difficulty,
      due_at: nextCard.due.toISOString(),
      last_review: now.toISOString(),
      reps: nextCard.reps,
      lapses: nextCard.lapses,
      state: nextCard.state,
    },
    elapsedDays,
  };
}

export function retrievability(state: PersistedCardState, now: Date = new Date()): number {
  if (state.state === State.New) return 0;
  return scheduler.get_retrievability(toFsrsCard(state), now, false) as number;
}
