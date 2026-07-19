/**
 * Distractor generation (section 5.2). Deterministic — no AI call needed.
 * Numeric: same order of magnitude (+/-20-60%), plus one "tempting" real
 * value from the same chapter. Names/places: same type, preferring the same
 * genealogical line / region when known. Never obviously absurd.
 */

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function numericDistractors(
  correct: number,
  poolValues: number[],
  seed: number,
): number[] {
  const isInt = Number.isInteger(correct);
  const round = (n: number) => (isInt ? Math.max(1, Math.round(n)) : Math.round(n * 100) / 100);

  const out = new Set<number>();
  let i = 0;
  while (out.size < 2 && i < 20) {
    const pct = 0.2 + seededRandom(seed + i) * 0.4; // 20-60%
    const sign = seededRandom(seed + i + 100) > 0.5 ? 1 : -1;
    const candidate = round(correct * (1 + sign * pct));
    if (candidate !== correct && candidate > 0) out.add(candidate);
    i++;
  }

  const tempting = poolValues
    .filter((v) => v !== correct && !out.has(v))
    .sort((a, b) => Math.abs(a - correct) - Math.abs(b - correct))[0];
  if (tempting != null) {
    out.add(tempting);
  } else {
    out.add(round(correct * 1.5));
  }

  return Array.from(out).slice(0, 3);
}

const foldName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/**
 * Picks 3 distractor entities. `excludeNames` must include the card's answer
 * text — the subject entity's id alone is not enough, because for "Ki volt
 * Séth fia?" the subject is Séth but the answer text is "Énós", and the
 * Énós entity (or a duplicate row of it) would otherwise be offered as a
 * "distractor" identical to the answer. Picks are also deduped against each
 * other by folded name so duplicate entity rows can't produce twin options.
 */
export function entityDistractors<T extends { id: number; type: string; name_hu: string }>(
  correct: T,
  pool: T[],
  preferredIds: Set<number> | undefined,
  seed: number,
  excludeNames: string[] = [],
): T[] {
  const excluded = new Set([foldName(correct.name_hu), ...excludeNames.map(foldName)]);
  const sameType = pool.filter((e) => e.type === correct.type && e.id !== correct.id && !excluded.has(foldName(e.name_hu)));
  const preferred = preferredIds ? sameType.filter((e) => preferredIds.has(e.id)) : [];
  const rest = sameType.filter((e) => !preferred.includes(e));

  const picked: T[] = [];
  const pickedNames = new Set<string>();
  for (const candidate of [...preferred, ...shuffle(rest, seed)]) {
    const name = foldName(candidate.name_hu);
    if (pickedNames.has(name)) continue;
    picked.push(candidate);
    pickedNames.add(name);
    if (picked.length === 3) break;
  }
  return picked;
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
