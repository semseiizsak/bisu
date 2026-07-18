export function dayIndexForDate(programStart: string, today: Date): number {
  const start = new Date(programStart + "T00:00:00");
  const diffDays = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  return Math.min(365, Math.max(1, diffDays + 1));
}
