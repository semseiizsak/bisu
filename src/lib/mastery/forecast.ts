/**
 * Naive linear-regression forecast (section 9.2's "Előrejelzés"). No
 * mastery-history table exists, so this regresses on cumulative distinct
 * cards-ever-reviewed per day (derived straight from the `reviews` log,
 * which does have real timestamps) over the last 30 days, then projects
 * the day index at which that reaches `targetRatio` of the total active
 * card pool.
 */
export function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function forecastDayToTarget(
  cumulativeByDay: number[], // index 0 = 30 days ago .. last = today
  totalActiveCards: number,
  currentDayIdx: number,
  targetRatio = 0.9,
): number | null {
  if (totalActiveCards === 0) return null;
  const points = cumulativeByDay.map((y, x) => ({ x, y }));
  const { slope, intercept } = linearRegression(points);
  if (slope <= 0) return null;

  const target = totalActiveCards * targetRatio;
  const xAtTarget = (target - intercept) / slope;
  const daysFromNow = xAtTarget - (cumulativeByDay.length - 1);
  if (!Number.isFinite(daysFromNow) || daysFromNow < 0) return null;
  return Math.round(currentDayIdx + daysFromNow);
}
