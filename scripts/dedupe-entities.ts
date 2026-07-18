/**
 * Entity deduplication (Phase 1, section 4.3). Flags likely-duplicate entity
 * pairs (matching aliases, or close name similarity within the same type)
 * for manual review — it does not auto-merge anything.
 *
 * Usage: npx tsx scripts/dedupe-entities.ts
 * Writes data/dedupe-review.json with candidate pairs sorted by confidence.
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { levenshtein, normalizeHu } from "../src/lib/content/text";
import { supabaseAdmin } from "./lib/supabase-admin";

interface EntityRow {
  id: number;
  type: string;
  name_hu: string;
  aliases: string[];
  ref_count: number;
}

function similarity(a: string, b: string): number {
  const na = normalizeHu(a);
  const nb = normalizeHu(b);
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

async function main() {
  const { data: entities, error } = await supabaseAdmin
    .from("entities")
    .select("id, type, name_hu, aliases, ref_count");
  if (error) throw error;

  const rows = entities as EntityRow[];
  const candidates: {
    a: { id: number; name_hu: string };
    b: { id: number; name_hu: string };
    reason: string;
    score: number;
  }[] = [];

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (a.type !== b.type) continue;

      const aNames = [a.name_hu, ...(a.aliases ?? [])];
      const bNames = [b.name_hu, ...(b.aliases ?? [])];

      let bestScore = 0;
      let reason = "";
      for (const an of aNames) {
        for (const bn of bNames) {
          const s = similarity(an, bn);
          if (s > bestScore) {
            bestScore = s;
            reason = normalizeHu(an) === normalizeHu(bn) ? "alias_exact_match" : "name_similarity";
          }
        }
      }

      if (bestScore >= 0.82) {
        candidates.push({
          a: { id: a.id, name_hu: a.name_hu },
          b: { id: b.id, name_hu: b.name_hu },
          reason,
          score: Math.round(bestScore * 100) / 100,
        });
      }
    }
  }

  candidates.sort((x, y) => y.score - x.score);

  const outPath = resolve(process.cwd(), "data/dedupe-review.json");
  await writeFile(outPath, JSON.stringify(candidates, null, 2), "utf-8");
  console.log(`Found ${candidates.length} candidate duplicate pairs. Written to ${outPath}`);
  console.log("Review manually — this script never merges automatically.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
