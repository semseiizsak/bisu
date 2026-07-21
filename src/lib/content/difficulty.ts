export type CardType = "recall" | "reverse" | "mcq" | "numeric" | "cloze" | "order" | "locate" | "map" | "chain" | "verse";

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
