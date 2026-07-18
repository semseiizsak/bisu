/**
 * Normalizes Hungarian answer text for comparison: lowercases, collapses the
 * ő/ö and ű/ü distinction (a common typing slip on non-Hungarian keyboards),
 * strips punctuation/whitespace noise. Diacritics are otherwise preserved —
 * "a" and "á" must still differ.
 */
export function normalizeHu(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFC")
    .replace(/[őö]/g, "o")
    .replace(/[űü]/g, "u")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function isCloseMatch(userAnswer: string, correct: string, maxDistance = 2): boolean {
  return levenshtein(normalizeHu(userAnswer), normalizeHu(correct)) <= maxDistance;
}

export function isExactMatch(userAnswer: string, accepted: string[]): boolean {
  const normalized = normalizeHu(userAnswer);
  return accepted.some((a) => normalizeHu(a) === normalized);
}
