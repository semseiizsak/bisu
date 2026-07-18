/** Discrete score buckets (no gradients, per the design system) — grey -> amber -> green. */
export function masteryBucketClass(score: number): string {
  if (score >= 0.75) return "bg-good/70 text-paper";
  if (score >= 0.5) return "bg-warn/70 text-paper";
  if (score >= 0.25) return "bg-warn/25 text-ink";
  if (score > 0) return "bg-line-strong text-ink-muted";
  return "bg-line text-ink-faint";
}
