/**
 * Section 10.3 — nightly contrast-detector. Finds verified numeric facts
 * whose values are a classic digit-confusion multiple apart (~2x or ~10x,
 * e.g. 40 vs 400, 12 vs 120) across different entities, and generates a
 * two-option contrast card for each side of the pair ("Melyik volt 40 és
 * melyik 400?").
 *
 * Usage: npx tsx scripts/detect-contrasts.ts
 */
import { calibrateDifficulty } from "../src/lib/content/difficulty";
import { supabaseAdmin } from "./lib/supabase-admin";

const RATIOS = [
  { target: 10, tolerance: 0.5 },
  { target: 2, tolerance: 0.15 },
];

function isConfusable(a: number, b: number): boolean {
  if (a === 0 || b === 0) return false;
  const ratio = Math.max(a, b) / Math.min(a, b);
  return RATIOS.some((r) => Math.abs(ratio - r.target) <= r.tolerance);
}

async function main() {
  const { data: facts } = await supabaseAdmin
    .from("facts")
    .select("id, entity_id, fact_key, fact_value, numeric_val, verse_ref, book_id, chapter")
    .eq("verified", true)
    .not("numeric_val", "is", null);
  const { data: entities } = await supabaseAdmin.from("entities").select("id, name_hu, importance, ref_count");
  const entityById = new Map((entities ?? []).map((e) => [e.id, e]));

  const { data: existingContrast } = await supabaseAdmin.from("cards").select("fact_id").contains("tags", ["contrast"]);
  const alreadyDone = new Set((existingContrast ?? []).map((c) => c.fact_id));

  const rows = (facts ?? []).filter((f) => f.numeric_val != null && f.entity_id != null);
  // Bucket by rounded magnitude to avoid full O(n^2) on the full corpus.
  const byMagnitude = new Map<number, typeof rows>();
  for (const f of rows) {
    const bucket = Math.round(Math.log10(f.numeric_val!));
    for (const b of [bucket - 1, bucket, bucket + 1]) {
      if (!byMagnitude.has(b)) byMagnitude.set(b, []);
      byMagnitude.get(b)!.push(f);
    }
  }

  const newCards: {
    type: string;
    prompt: string;
    prompt_raw: string;
    answer: string;
    payload: { options: string[] };
    fact_id: number;
    entity_id: number;
    book_id: number | null;
    chapter: number | null;
    verse_ref: string;
    difficulty: number;
    tags: string[];
    source: string;
  }[] = [];
  const seenPairs = new Set<string>();

  for (const f of rows) {
    if (alreadyDone.has(f.id)) continue;
    const bucket = Math.round(Math.log10(f.numeric_val!));
    const candidates = byMagnitude.get(bucket) ?? [];
    for (const g of candidates) {
      if (g.id === f.id || g.entity_id === f.entity_id) continue;
      if (!isConfusable(f.numeric_val!, g.numeric_val!)) continue;
      const pairKey = [f.id, g.id].sort().join(":");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const entity = entityById.get(f.entity_id!);
      if (!entity) continue;
      const options = Math.random() > 0.5 ? [f.numeric_val, g.numeric_val] : [g.numeric_val, f.numeric_val];

      newCards.push({
        type: "mcq",
        prompt: `Melyik érték igaz: ${entity.name_hu} ${f.fact_key.replace(/_/g, " ")}?`,
        prompt_raw: `Melyik érték igaz: ${entity.name_hu} ${f.fact_key.replace(/_/g, " ")}?`,
        answer: String(f.numeric_val),
        payload: { options: options.map(String) as string[] },
        fact_id: f.id,
        entity_id: f.entity_id!,
        book_id: f.book_id,
        chapter: f.chapter,
        verse_ref: f.verse_ref,
        difficulty: calibrateDifficulty({ entityImportance: entity.importance, entityRefCount: entity.ref_count, numericVal: f.numeric_val, type: "mcq" }),
        tags: ["contrast"],
        source: "generated",
      });
      break; // one contrast partner per fact is enough
    }
  }

  console.log(`Found ${newCards.length} new contrast cards. Inserting…`);
  if (newCards.length === 0) return;

  const { data: inserted, error } = await supabaseAdmin.from("cards").insert(newCards).select("id");
  if (error) throw error;

  const now = new Date().toISOString();
  const states = (inserted ?? []).map((c) => ({ card_id: c.id, state: 0, due_at: now, reps: 0, lapses: 0, suspended: false }));
  const { error: stateError } = await supabaseAdmin.from("card_states").insert(states);
  if (stateError) throw stateError;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
