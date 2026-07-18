import type { CardType } from "@/lib/content/difficulty";

/** Section 10.1 — the reformulation sequence for a fact rated Easy 3x in a row. */
const VARIANT_SEQUENCE: CardType[] = ["recall", "reverse", "cloze", "mcq", "numeric"];

export function nextVariantType(currentType: CardType): CardType | null {
  const idx = VARIANT_SEQUENCE.indexOf(currentType);
  if (idx === -1 || idx === VARIANT_SEQUENCE.length - 1) return null;
  return VARIANT_SEQUENCE[idx + 1];
}

export function isEasyStreak(ratings: number[], streakLength = 3): boolean {
  if (ratings.length < streakLength) return false;
  return ratings.slice(0, streakLength).every((r) => r === 4);
}
