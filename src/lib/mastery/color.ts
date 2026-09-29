/** Discrete score buckets — grey → sky → gold → green, no gradients. */
export function masteryBucketClass(score: number): string {
  if (score >= 0.75) return "bg-good text-white";
  if (score >= 0.5) return "bg-gold text-ink";
  if (score >= 0.25) return "bg-sky/70 text-white";
  if (score > 0) return "bg-sky/25 text-ink";
  return "bg-line text-ink-faint";
}
