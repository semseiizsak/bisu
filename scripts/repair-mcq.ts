/**
 * Recomputes MCQ options for existing cards under the fixed distractor
 * rules (answer-text exclusion, same-book pool, name-level dedupe — see
 * src/lib/content/distractors.ts). Card ids, prompts, answers and FSRS
 * state are untouched; only `distractors` + `payload.options` change.
 *
 * Two-option contrast cards (tags @> {contrast}) are deliberate and skipped.
 *
 * Usage:
 *   npx tsx scripts/repair-mcq.ts            # report + write
 *   npx tsx scripts/repair-mcq.ts --dry-run  # report only
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { numericDistractors, entityDistractors } from "../src/lib/content/distractors";
import { supabaseAdmin } from "./lib/supabase-admin";

config({ path: resolve(process.cwd(), ".env.local") });

interface EntityRow {
  id: number;
  type: string;
  name_hu: string;
}
interface CardRow {
  id: number;
  answer: string;
  tags: string[];
  payload: { options?: string[] } | null;
  facts: {
    fact_value: string;
    numeric_val: number | null;
    book_id: number | null;
    entity_id: number | null;
  } | null;
}

function shuffleDeterministic<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  const rand = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand(seed + i) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const [{ data: cardRows, error }, { data: entities }, { data: facts }, { data: genealogyEdges }] = await Promise.all([
    supabaseAdmin
      .from("cards")
      .select("id, answer, tags, payload, facts(fact_value, numeric_val, book_id, entity_id)")
      .eq("type", "mcq")
      .eq("active", true)
      .not("fact_id", "is", null)
      .order("id"),
    supabaseAdmin.from("entities").select("id, type, name_hu"),
    supabaseAdmin.from("facts").select("entity_id, numeric_val, book_id"),
    supabaseAdmin.from("genealogy_edges").select("parent_id, child_id"),
  ]);
  if (error) throw error;

  const entityList = (entities ?? []) as EntityRow[];
  const entityById = new Map(entityList.map((e) => [e.id, e]));

  const numericPoolByBook = new Map<number, number[]>();
  const mcqEntitiesByBook = new Map<number, EntityRow[]>();
  for (const f of facts ?? []) {
    if (f.book_id == null) continue;
    if (f.numeric_val != null) {
      if (!numericPoolByBook.has(f.book_id)) numericPoolByBook.set(f.book_id, []);
      numericPoolByBook.get(f.book_id)!.push(f.numeric_val);
    }
    if (f.entity_id != null) {
      const e = entityById.get(f.entity_id);
      if (!e) continue;
      if (!mcqEntitiesByBook.has(f.book_id)) mcqEntitiesByBook.set(f.book_id, []);
      const pool = mcqEntitiesByBook.get(f.book_id)!;
      if (!pool.some((p) => p.id === e.id)) pool.push(e);
    }
  }

  const genealogyByEntity = new Map<number, Set<number>>();
  for (const edge of genealogyEdges ?? []) {
    for (const [a, b] of [
      [edge.parent_id, edge.child_id],
      [edge.child_id, edge.parent_id],
    ] as [number, number][]) {
      if (a == null || b == null) continue;
      if (!genealogyByEntity.has(a)) genealogyByEntity.set(a, new Set());
      genealogyByEntity.get(a)!.add(b);
    }
  }

  const cards = (cardRows ?? []) as unknown as CardRow[];
  let repaired = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const card of cards) {
    if ((card.tags ?? []).includes("contrast")) continue;
    const f = card.facts;
    if (!f) continue;

    let options: string[] | null = null;
    if (f.numeric_val != null) {
      const pool = numericPoolByBook.get(f.book_id ?? -1) ?? [];
      const distractors = numericDistractors(f.numeric_val, pool, card.id);
      options = [String(f.numeric_val), ...distractors.map(String)];
    } else if (f.entity_id != null) {
      const entity = entityById.get(f.entity_id);
      if (entity && (entity.type === "person" || entity.type === "place")) {
        const sameBookPool = mcqEntitiesByBook.get(f.book_id ?? -1) ?? [];
        const pool = sameBookPool.length >= 8 ? sameBookPool : entityList;
        const distractors = entityDistractors(entity, pool, genealogyByEntity.get(entity.id), card.id, [f.fact_value]);
        if (distractors.length === 3) options = [f.fact_value, ...distractors.map((d) => d.name_hu)];
      }
    }

    if (!options || new Set(options.map((o) => o.trim().toLowerCase())).size < 4) {
      skipped++;
      console.log(`  #${card.id} SKIP (cannot build 4 unique options) — current: ${JSON.stringify(card.payload?.options)}`);
      continue;
    }

    // Rewrite whenever the recomputed set differs — a card can have 4 unique
    // options that still come from the old cross-book pool (Ruth in a Genesis
    // genealogy question), so "no duplicates" alone is not "already ok".
    const shuffled = shuffleDeterministic(options, card.id);
    const current = card.payload?.options ?? [];
    if (current.length === shuffled.length && current.every((o, i) => o === shuffled[i])) {
      unchanged++;
      continue;
    }

    repaired++;
    console.log(`  #${card.id}: ${JSON.stringify(current)} -> ${JSON.stringify(shuffled)}`);
    if (!dryRun) {
      const { error: updateError } = await supabaseAdmin
        .from("cards")
        .update({
          distractors: shuffled.filter((o) => o !== card.answer),
          payload: { ...(card.payload ?? {}), options: shuffled },
        })
        .eq("id", card.id);
      if (updateError) throw updateError;
    }
  }

  console.log(`\nDone. repaired: ${repaired}, already-ok: ${unchanged}, skipped: ${skipped}${dryRun ? " [dry-run]" : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
