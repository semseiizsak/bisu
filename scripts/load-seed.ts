/**
 * Loads hand-extracted seed content (data/seed/*.json, following the same
 * shape scripts/extract-facts.ts produces) into entities/facts/
 * timeline_events/genealogy_edges/geo_places.
 *
 * Usage: npx tsx scripts/load-seed.ts data/seed/genesis-1-11.json data/seed/ruth.json
 */
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { BOOKS } from "../src/lib/content/books";
import { supabaseAdmin } from "./lib/supabase-admin";

interface SeedEntity {
  type: string;
  name_hu: string;
  aliases: string[];
  summary: string;
  first_ref: string;
  importance: number;
}
interface SeedFact {
  entity_name: string;
  fact_key: string;
  fact_value: string;
  numeric_val?: number;
  unit?: string;
  verse_ref: string;
  difficulty: number;
  confidence: number;
  tags?: string[];
}
interface SeedTimelineEvent {
  label_hu: string;
  era: string;
  order_idx: number;
  approx_year: string | null;
  verse_ref: string;
  importance: number;
}
interface SeedGenealogyEdge {
  parent: string;
  child: string;
  line: string;
  verse_ref: string;
}
interface SeedGeoPlace {
  entity_name: string;
  svg_x: number;
  svg_y: number;
  place_type: string;
  tolerance: number;
}
interface SeedFile {
  book_slug: string;
  entities: SeedEntity[];
  facts: SeedFact[];
  timeline_events: SeedTimelineEvent[];
  genealogy_edges: SeedGenealogyEdge[];
  geo_places?: SeedGeoPlace[];
}

const shortHuToBookId = new Map<string, number>();

async function loadBookIndex() {
  const { data, error } = await supabaseAdmin.from("books").select("id, slug");
  if (error) throw error;
  const slugToId = new Map(data!.map((b) => [b.slug, b.id]));
  for (const b of BOOKS) {
    const id = slugToId.get(b.slug);
    if (id) shortHuToBookId.set(b.short_hu, id);
  }
}

function parseVerseRef(ref: string): { book_id: number | null; chapter: number | null } {
  const match = ref.match(/^(\S+)\s+(\d+):(\d+)/);
  if (!match) return { book_id: null, chapter: null };
  const [, short, chapter] = match;
  return { book_id: shortHuToBookId.get(short) ?? null, chapter: Number(chapter) };
}

async function resolveOrCreateEntity(e: SeedEntity, cache: Map<string, number>): Promise<number> {
  if (cache.has(e.name_hu)) return cache.get(e.name_hu)!;

  const { data: existing, error: findError } = await supabaseAdmin
    .from("entities")
    .select("id")
    .eq("name_hu", e.name_hu)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    cache.set(e.name_hu, existing.id);
    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("entities")
    .insert({
      type: e.type,
      name_hu: e.name_hu,
      aliases: e.aliases,
      summary: e.summary,
      first_ref: e.first_ref,
      importance: e.importance,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  cache.set(e.name_hu, inserted.id);
  return inserted.id;
}

async function loadFile(path: string, entityCache: Map<string, number>) {
  console.log(`\n--- ${path} ---`);
  const raw = await readFile(path, "utf-8");
  const seed: SeedFile = JSON.parse(raw);

  console.log(`Resolving ${seed.entities.length} entities…`);
  for (const e of seed.entities) {
    await resolveOrCreateEntity(e, entityCache);
  }

  console.log(`Inserting ${seed.facts.length} facts…`);
  const factRows = seed.facts.map((f) => {
    const entityId = entityCache.get(f.entity_name);
    if (!entityId) throw new Error(`Unknown entity referenced by fact: ${f.entity_name}`);
    const { book_id, chapter } = parseVerseRef(f.verse_ref);
    return {
      entity_id: entityId,
      fact_key: f.fact_key,
      fact_value: f.fact_value,
      numeric_val: f.numeric_val ?? null,
      unit: f.unit ?? null,
      verse_ref: f.verse_ref,
      book_id,
      chapter,
      difficulty: f.difficulty,
      confidence: f.confidence,
      verified: f.confidence >= 0.9,
      tags: f.tags ?? [],
    };
  });
  if (factRows.length) {
    const { error } = await supabaseAdmin.from("facts").insert(factRows);
    if (error) throw error;
  }

  console.log(`Inserting ${seed.timeline_events.length} timeline events…`);
  if (seed.timeline_events.length) {
    const { error } = await supabaseAdmin.from("timeline_events").insert(seed.timeline_events);
    if (error) throw error;
  }

  console.log(`Inserting ${seed.genealogy_edges.length} genealogy edges…`);
  const edgeRows = seed.genealogy_edges.map((edge) => {
    const parentId = entityCache.get(edge.parent);
    const childId = entityCache.get(edge.child);
    if (!parentId || !childId) {
      throw new Error(`Unknown entity in genealogy edge: ${edge.parent} -> ${edge.child}`);
    }
    return { parent_id: parentId, child_id: childId, line: edge.line, verse_ref: edge.verse_ref };
  });
  if (edgeRows.length) {
    const { error } = await supabaseAdmin.from("genealogy_edges").insert(edgeRows);
    if (error) throw error;
  }

  if (seed.geo_places?.length) {
    console.log(`Inserting ${seed.geo_places.length} geo places…`);
    const geoRows = seed.geo_places.map((g) => {
      const entityId = entityCache.get(g.entity_name);
      if (!entityId) throw new Error(`Unknown entity referenced by geo_place: ${g.entity_name}`);
      return {
        entity_id: entityId,
        svg_x: g.svg_x,
        svg_y: g.svg_y,
        place_type: g.place_type,
        tolerance: g.tolerance,
      };
    });
    const { error } = await supabaseAdmin.from("geo_places").insert(geoRows);
    if (error) throw error;
  }
}

async function updateRefCounts() {
  console.log("\nUpdating entity ref_count…");
  const { data: facts, error } = await supabaseAdmin.from("facts").select("entity_id");
  if (error) throw error;
  const counts = new Map<number, number>();
  for (const f of facts ?? []) {
    if (f.entity_id) counts.set(f.entity_id, (counts.get(f.entity_id) ?? 0) + 1);
  }
  for (const [entity_id, ref_count] of counts) {
    const { error: updateError } = await supabaseAdmin
      .from("entities")
      .update({ ref_count })
      .eq("id", entity_id);
    if (updateError) throw updateError;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const files =
    args.length > 0
      ? args
      : (await readdir(resolve(process.cwd(), "data/seed")))
          .filter((f) => f.endsWith(".json"))
          .map((f) => resolve(process.cwd(), "data/seed", f));

  await loadBookIndex();
  const entityCache = new Map<string, number>();
  for (const file of files) {
    await loadFile(file, entityCache);
  }
  await updateRefCounts();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
