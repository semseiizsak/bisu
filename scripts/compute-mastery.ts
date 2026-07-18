/**
 * Nightly mastery job (section 9.1). Computes coverage/retention/score for
 * three scope types:
 *   - book:   scope_id = book slug
 *   - entity: scope_id = "entity:<id>"
 *   - era:    scope_id = era name (derived from `order`-type cards, which
 *             are tagged with their era at generation time)
 *
 * Usage: npx tsx scripts/compute-mastery.ts
 */
import { computeMastery } from "../src/lib/mastery/compute";
import { supabaseAdmin } from "./lib/supabase-admin";

interface CardRow {
  id: number;
  book_id: number | null;
  entity_id: number | null;
  difficulty: number;
  tags: string[];
  type: string;
}
interface StateRow {
  card_id: number;
  stability: number | null;
}

async function main() {
  const [{ data: books }, { data: cards }, { data: states }] = await Promise.all([
    supabaseAdmin.from("books").select("id, slug"),
    supabaseAdmin.from("cards").select("id, book_id, entity_id, difficulty, tags, type").eq("active", true),
    supabaseAdmin.from("card_states").select("card_id, stability"),
  ]);

  const stabilityByCard = new Map((states as StateRow[] ?? []).map((s) => [s.card_id, s.stability]));
  const bookSlugById = new Map((books ?? []).map((b) => [b.id, b.slug]));

  const byBook = new Map<string, CardRow[]>();
  const byEntity = new Map<string, CardRow[]>();
  const byEra = new Map<string, CardRow[]>();

  for (const c of (cards ?? []) as CardRow[]) {
    if (c.book_id != null) {
      const slug = bookSlugById.get(c.book_id);
      if (slug) {
        if (!byBook.has(slug)) byBook.set(slug, []);
        byBook.get(slug)!.push(c);
      }
    }
    if (c.entity_id != null) {
      const key = `entity:${c.entity_id}`;
      if (!byEntity.has(key)) byEntity.set(key, []);
      byEntity.get(key)!.push(c);
    }
    if (c.type === "order") {
      for (const tag of c.tags ?? []) {
        if (!byEra.has(tag)) byEra.set(tag, []);
        byEra.get(tag)!.push(c);
      }
    }
  }

  const rows: { scope_type: string; scope_id: string; coverage: number; retention: number; score: number; card_count: number; updated_at: string }[] = [];
  const now = new Date().toISOString();

  function pushScope(scope_type: string, scope_id: string, group: CardRow[]) {
    const { coverage, retention, score } = computeMastery(
      group.map((c) => ({ difficulty: c.difficulty, stability: stabilityByCard.get(c.id) ?? null })),
    );
    rows.push({ scope_type, scope_id, coverage, retention, score, card_count: group.length, updated_at: now });
  }

  for (const [slug, group] of byBook) pushScope("book", slug, group);
  for (const [key, group] of byEntity) pushScope("entity", key, group);
  for (const [era, group] of byEra) pushScope("era", era, group);

  console.log(`Computed mastery for ${rows.length} scopes. Upserting…`);
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabaseAdmin.from("mastery").upsert(rows.slice(i, i + BATCH), { onConflict: "scope_type,scope_id" });
    if (error) throw error;
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
