import type { CardType } from "@/lib/content/difficulty";

/** Section 6.2 baseline estimates, in minutes. Self-calibrates after ~30 days (see calibrateEstimates). */
export const DEFAULT_TIME_ESTIMATES: { reading_per_verse: number; card: Record<CardType, number> } = {
  reading_per_verse: 0.055, // ~200 wpm calibrated for Károli
  card: {
    recall: 0.25,
    reverse: 0.25,
    mcq: 0.18,
    numeric: 0.22,
    cloze: 0.3,
    locate: 0.35,
    order: 0.9,
    chain: 0.75,
    map: 0.6,
  },
};

export function estimateReadingMinutes(verseCount: number, minutesPerVerse = DEFAULT_TIME_ESTIMATES.reading_per_verse): number {
  return verseCount * minutesPerVerse;
}

export function estimateCardMinutes(type: CardType, estimates = DEFAULT_TIME_ESTIMATES): number {
  return estimates.card[type] ?? 0.3;
}

export interface CalibratedEstimates {
  reading_per_verse: number;
  card: Record<string, number>;
}

/**
 * Recomputes per-type median review duration from `reviews.duration_ms`
 * (last 30 days). Falls back to defaults for types with too few samples.
 * Meant to be called periodically (e.g. nightly) and the result cached in
 * `settings` or a meta table — the session builder takes it as an input
 * rather than querying on every call.
 */
export function calibrateFromDurations(
  rows: { mode: string | null; duration_ms: number | null }[],
): CalibratedEstimates {
  const byType = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.duration_ms || r.duration_ms <= 0 || r.duration_ms > 5 * 60_000) continue; // discard outliers
    const type = (r.mode ?? "").replace(/^srs:|^game:/, "");
    if (!type) continue;
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(r.duration_ms);
  }

  const card: Record<string, number> = { ...DEFAULT_TIME_ESTIMATES.card };
  for (const [type, durations] of byType) {
    if (durations.length < 20) continue; // not enough samples yet
    durations.sort((a, b) => a - b);
    const median = durations[Math.floor(durations.length / 2)];
    card[type] = Math.round((median / 60_000) * 100) / 100;
  }

  return { reading_per_verse: DEFAULT_TIME_ESTIMATES.reading_per_verse, card };
}
