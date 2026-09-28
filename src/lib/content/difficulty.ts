/**
 * Card types still in use:
 * - question: generated per chapter, one finished question with distractors
 *   and a short explanation (the whole quiz is built from these)
 * - recall: hand-written cards from the reader ("Kézzel írom" / "AI kérdés")
 * - verse: memorized verses (first-letter trainer)
 * - locate / order / chain / map: game-only card types, never in the quiz
 * The remaining names are legacy fan-out types that migration 0013 retired;
 * they stay in the union so old rows still type-check when loaded.
 */
export type CardType = "question" | "recall" | "verse" | "locate" | "order" | "chain" | "map" | "reverse" | "mcq" | "numeric" | "cloze";

/** Types the spaced-repetition quiz draws from. Everything else is a game. */
export const SRS_CARD_TYPES: readonly CardType[] = ["question", "recall", "verse"];

interface DifficultyInput {
  entityImportance?: number | null;
  entityRefCount?: number | null;
  numericVal?: number | null;
  type: CardType;
}

/** Section 5.3 calibration formula. */
export function calibrateDifficulty({ entityImportance, entityRefCount, numericVal, type }: DifficultyInput): number {
  let d = 3;
  if (entityImportance != null && entityImportance >= 4) d -= 1;
  if (numericVal != null && numericVal > 100) d += 1;
  if (entityRefCount != null && entityRefCount < 3) d += 1;
  if (type === "mcq") d -= 1;
  if (type === "reverse" || type === "numeric") d += 1;
  return Math.min(5, Math.max(1, d));
}
