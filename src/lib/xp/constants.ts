export const XP = {
  READING: 50,
  CORRECT_CARD: 2,
  GAME: 20,
  BLITZ_PERFECT: 25,
} as const;

/** Level thresholds grow quadratically (1→150→450→900…) so early levels come fast. */
export function xpForLevel(level: number): number {
  return 75 * level * (level - 1);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function xpToNextLevel(xp: number): { current: number; next: number; level: number } {
  const level = levelForXp(xp);
  return { current: xpForLevel(level), next: xpForLevel(level + 1), level };
}
