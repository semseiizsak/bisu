/** Section 9.1 mastery formula, shared between the nightly script and any future incremental updater. */
export interface MasteryCardInput {
  difficulty: number; // card.difficulty (1-5), used as the retention weight
  stability: number | null; // fsrs stability in days; null = never reviewed
}

export function computeMastery(cards: MasteryCardInput[]): { coverage: number; retention: number; score: number } {
  if (cards.length === 0) return { coverage: 0, retention: 0, score: 0 };

  const seen = cards.filter((c) => c.stability != null);
  const coverage = seen.length / cards.length;

  let weightedSum = 0;
  let weightTotal = 0;
  for (const c of seen) {
    const w = c.difficulty;
    const r = Math.min(1, Math.log((c.stability ?? 0) + 1) / Math.log(90));
    weightedSum += w * r;
    weightTotal += w;
  }
  const retention = weightTotal > 0 ? weightedSum / weightTotal : 0;

  const score = 0.5 * coverage + 0.5 * retention;
  return { coverage, retention, score };
}
