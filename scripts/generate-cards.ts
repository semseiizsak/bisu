/**
 * Deterministic card generator (Phase 2, section 5). Builds cards from
 * facts/entities/timeline_events/genealogy_edges/geo_places/verses. No AI
 * call needed — templates + distractor logic are all deterministic, per
 * section 5.2 ("Ez olcsó és pontos. Csak a megfogalmazás csiszolásához és
 * az MCQ distractorokhoz kell Claude" — we skip the polish pass here and
 * accept the plain template phrasing).
 *
 * Only pulls from `verified = true` facts (principle #4: no generated fact
 * goes live without human validation below confidence 0.9).
 *
 * Usage: npx tsx scripts/generate-cards.ts
 */
import { calibrateDifficulty, type CardType } from "../src/lib/content/difficulty";
import { numericDistractors, entityDistractors } from "../src/lib/content/distractors";
import { supabaseAdmin } from "./lib/supabase-admin";
import type {
  McqPayload,
  NumericPayload,
  ClozePayload,
  OrderPayload,
  LocatePayload,
  ChainPayload,
  MapPayload,
} from "../src/lib/content/card-payloads";

interface EntityRow {
  id: number;
  type: string;
  name_hu: string;
  importance: number;
  ref_count: number;
}
interface FactRow {
  id: number;
  entity_id: number | null;
  fact_key: string;
  fact_value: string;
  numeric_val: number | null;
  unit: string | null;
  verse_ref: string;
  book_id: number | null;
  chapter: number | null;
}
interface BookRow {
  id: number;
  slug: string;
  short_hu: string;
}
interface TimelineEventRow {
  id: number;
  label_hu: string;
  era: string;
  order_idx: number;
  verse_ref: string | null;
}
interface GenealogyEdgeRow {
  id: number;
  parent_id: number;
  child_id: number;
  line: string;
  verse_ref: string | null;
}
interface GeoPlaceRow {
  id: number;
  entity_id: number;
  svg_x: number;
  svg_y: number;
  place_type: string | null;
  tolerance: number;
}
interface VerseRow {
  id: number;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
}

interface NewCard {
  type: CardType;
  prompt: string;
  answer: string;
  answer_alt: string[];
  distractors: string[];
  payload: object | null;
  fact_id: number | null;
  entity_id: number | null;
  book_id: number | null;
  chapter: number | null;
  verse_ref: string | null;
  difficulty: number;
  tags: string[];
  source: string;
}

const humanizeKey = (key: string) => key.replace(/_/g, " ");

async function main() {
  console.log("Loading content…");
  const [{ data: entities }, { data: facts }, { data: books }, { data: timelineEvents }, { data: genealogyEdges }, { data: geoPlaces }, { data: verses }] =
    await Promise.all([
      supabaseAdmin.from("entities").select("id, type, name_hu, importance, ref_count"),
      supabaseAdmin
        .from("facts")
        .select("id, entity_id, fact_key, fact_value, numeric_val, unit, verse_ref, book_id, chapter")
        .eq("verified", true),
      supabaseAdmin.from("books").select("id, slug, short_hu"),
      supabaseAdmin.from("timeline_events").select("id, label_hu, era, order_idx, verse_ref").order("order_idx"),
      supabaseAdmin.from("genealogy_edges").select("id, parent_id, child_id, line, verse_ref"),
      supabaseAdmin.from("geo_places").select("id, entity_id, svg_x, svg_y, place_type, tolerance"),
      supabaseAdmin.from("verses").select("id, book_id, chapter, verse, text"),
    ]);

  const entityById = new Map((entities as EntityRow[]).map((e) => [e.id, e]));
  const bookById = new Map((books as BookRow[]).map((b) => [b.id, b]));
  const factRows = (facts ?? []) as FactRow[];

  const { data: existingCards } = await supabaseAdmin.from("cards").select("fact_id, type");
  const existingKey = new Set((existingCards ?? []).map((c) => `${c.fact_id}:${c.type}`));

  const newCards: NewCard[] = [];

  function difficultyFor(type: CardType, entity: EntityRow | undefined, numericVal: number | null) {
    return calibrateDifficulty({
      entityImportance: entity?.importance,
      entityRefCount: entity?.ref_count,
      numericVal,
      type,
    });
  }

  // --- recall ---------------------------------------------------------
  for (const f of factRows) {
    if (existingKey.has(`${f.id}:recall`)) continue;
    const entity = f.entity_id ? entityById.get(f.entity_id) : undefined;
    if (!entity) continue;
    newCards.push({
      type: "recall",
      prompt: `Mi volt ${entity.name_hu} ${humanizeKey(f.fact_key)}?`,
      answer: f.fact_value,
      answer_alt: f.numeric_val != null ? [String(f.numeric_val)] : [],
      distractors: [],
      payload: null,
      fact_id: f.id,
      entity_id: entity.id,
      book_id: f.book_id,
      chapter: f.chapter,
      verse_ref: f.verse_ref,
      difficulty: difficultyFor("recall", entity, f.numeric_val),
      tags: [],
      source: "generated",
    });
  }

  // --- reverse (numeric or short relational facts) ---------------------
  const RELATIONAL_KEYS = new Set(["apja", "fia", "felesége", "anyja", "második_férje", "első_férje"]);
  for (const f of factRows) {
    if (existingKey.has(`${f.id}:reverse`)) continue;
    const entity = f.entity_id ? entityById.get(f.entity_id) : undefined;
    if (!entity) continue;
    const invertible = f.numeric_val != null || RELATIONAL_KEYS.has(f.fact_key);
    if (!invertible) continue;
    if (f.fact_value.length > 40) continue;
    newCards.push({
      type: "reverse",
      prompt: `Kinek/minek volt ${f.fact_value} a(z) ${humanizeKey(f.fact_key)}?`,
      answer: entity.name_hu,
      answer_alt: [],
      distractors: [],
      payload: null,
      fact_id: f.id,
      entity_id: entity.id,
      book_id: f.book_id,
      chapter: f.chapter,
      verse_ref: f.verse_ref,
      difficulty: difficultyFor("reverse", entity, f.numeric_val),
      tags: [],
      source: "generated",
    });
  }

  // --- numeric -----------------------------------------------------------
  for (const f of factRows) {
    if (f.numeric_val == null) continue;
    if (existingKey.has(`${f.id}:numeric`)) continue;
    const entity = f.entity_id ? entityById.get(f.entity_id) : undefined;
    if (!entity) continue;
    const payload: NumericPayload = { unit: f.unit };
    newCards.push({
      type: "numeric",
      prompt: `Hány ${f.unit ?? ""}? ${entity.name_hu} — ${humanizeKey(f.fact_key)}`.trim(),
      answer: String(f.numeric_val),
      answer_alt: [],
      distractors: [],
      payload,
      fact_id: f.id,
      entity_id: entity.id,
      book_id: f.book_id,
      chapter: f.chapter,
      verse_ref: f.verse_ref,
      difficulty: difficultyFor("numeric", entity, f.numeric_val),
      tags: [],
      source: "generated",
    });
  }

  // --- mcq (wraps recall-style prompt with 4 options) --------------------
  const numericPoolByBook = new Map<number, number[]>();
  for (const f of factRows) {
    if (f.numeric_val == null || f.book_id == null) continue;
    if (!numericPoolByBook.has(f.book_id)) numericPoolByBook.set(f.book_id, []);
    numericPoolByBook.get(f.book_id)!.push(f.numeric_val);
  }
  const entityList = entities as EntityRow[];
  const genealogyByEntity = new Map<number, Set<number>>();
  for (const edge of (genealogyEdges ?? []) as GenealogyEdgeRow[]) {
    for (const [a, b] of [
      [edge.parent_id, edge.child_id],
      [edge.child_id, edge.parent_id],
    ]) {
      if (!genealogyByEntity.has(a)) genealogyByEntity.set(a, new Set());
      genealogyByEntity.get(a)!.add(b);
    }
  }

  let mcqSeed = 1;
  for (const f of factRows) {
    if (existingKey.has(`${f.id}:mcq`)) continue;
    const entity = f.entity_id ? entityById.get(f.entity_id) : undefined;
    if (!entity) continue;
    mcqSeed++;

    let options: string[];
    if (f.numeric_val != null) {
      const pool = numericPoolByBook.get(f.book_id ?? -1) ?? [];
      const distractors = numericDistractors(f.numeric_val, pool, mcqSeed);
      options = [String(f.numeric_val), ...distractors.map(String)];
    } else if (entity.type === "person" || entity.type === "place") {
      const distractors = entityDistractors(entity, entityList, genealogyByEntity.get(entity.id), mcqSeed);
      if (distractors.length < 3) continue;
      options = [f.fact_value, ...distractors.map((d) => d.name_hu)];
    } else {
      continue;
    }
    options = shuffleDeterministic(options, mcqSeed);
    const payload: McqPayload = { options };

    newCards.push({
      type: "mcq",
      prompt: `Mi volt ${entity.name_hu} ${humanizeKey(f.fact_key)}?`,
      answer: f.numeric_val != null ? String(f.numeric_val) : f.fact_value,
      answer_alt: [],
      distractors: options.filter((o) => o !== (f.numeric_val != null ? String(f.numeric_val) : f.fact_value)),
      payload,
      fact_id: f.id,
      entity_id: entity.id,
      book_id: f.book_id,
      chapter: f.chapter,
      verse_ref: f.verse_ref,
      difficulty: difficultyFor("mcq", entity, f.numeric_val),
      tags: [],
      source: "generated",
    });
  }

  // --- cloze (entity name blanked out inside a verse it appears in) ------
  const verseRows = (verses ?? []) as VerseRow[];
  const entitiesByBook = new Map<number, EntityRow[]>();
  for (const f of factRows) {
    if (f.book_id == null || f.entity_id == null) continue;
    if (!entitiesByBook.has(f.book_id)) entitiesByBook.set(f.book_id, []);
    const e = entityById.get(f.entity_id);
    if (e && e.name_hu.length >= 3) entitiesByBook.get(f.book_id)!.push(e);
  }
  const clozeSeen = new Set<string>();
  for (const v of verseRows) {
    const candidates = entitiesByBook.get(v.book_id) ?? [];
    for (const entity of candidates) {
      if (!v.text.includes(entity.name_hu)) continue;
      const key = `${v.id}:${entity.id}`;
      if (clozeSeen.has(key)) continue;
      clozeSeen.add(key);
      const masked = v.text.replace(entity.name_hu, "_____");
      const book = bookById.get(v.book_id);
      const verseRef = book ? `${book.short_hu} ${v.chapter}:${v.verse}` : null;
      const payload: ClozePayload = { full_verse: v.text };
      newCards.push({
        type: "cloze",
        prompt: masked,
        answer: entity.name_hu,
        answer_alt: [],
        distractors: [],
        payload,
        fact_id: null,
        entity_id: entity.id,
        book_id: v.book_id,
        chapter: v.chapter,
        verse_ref: verseRef,
        difficulty: difficultyFor("cloze", entity, null),
        tags: [],
        source: "generated",
      });
      break; // one cloze card per verse is enough
    }
  }

  // --- locate (verse -> book/chapter) ------------------------------------
  let locateCount = 0;
  for (const v of verseRows) {
    if (v.verse !== 1) continue; // first verse of each chapter is a clean anchor
    const book = bookById.get(v.book_id);
    if (!book) continue;
    locateCount++;
    const payload: LocatePayload = { verse_text: v.text, book_id: v.book_id, chapter: v.chapter };
    newCards.push({
      type: "locate",
      prompt: v.text,
      answer: `${book.short_hu} ${v.chapter}`,
      answer_alt: [],
      distractors: [],
      payload,
      fact_id: null,
      entity_id: null,
      book_id: v.book_id,
      chapter: v.chapter,
      verse_ref: `${book.short_hu} ${v.chapter}:${v.verse}`,
      difficulty: 3,
      tags: [],
      source: "generated",
    });
  }
  void locateCount;

  // --- order (timeline_events grouped by era, chunks of 5-8) -------------
  const eventsByEra = new Map<string, TimelineEventRow[]>();
  for (const t of (timelineEvents ?? []) as TimelineEventRow[]) {
    if (!eventsByEra.has(t.era)) eventsByEra.set(t.era, []);
    eventsByEra.get(t.era)!.push(t);
  }
  for (const [era, events] of eventsByEra) {
    for (let i = 0; i < events.length; i += 6) {
      const chunk = events.slice(i, i + 6);
      if (chunk.length < 3) continue;
      const items = chunk.map((e) => ({ id: e.id, label: e.label_hu }));
      const payload: OrderPayload = { items, correct_order: chunk.map((e) => e.id) };
      newCards.push({
        type: "order",
        prompt: `Állítsd időrendbe (${era})`,
        answer: chunk.map((e) => e.id).join(","),
        answer_alt: [],
        distractors: [],
        payload,
        fact_id: null,
        entity_id: null,
        book_id: null,
        chapter: null,
        verse_ref: chunk[0]?.verse_ref ?? null,
        difficulty: 4,
        tags: [era],
        source: "generated",
      });
    }
  }

  // --- chain (genealogy edges) --------------------------------------------
  for (const edge of (genealogyEdges ?? []) as GenealogyEdgeRow[]) {
    const parent = entityById.get(edge.parent_id);
    const child = entityById.get(edge.child_id);
    if (!parent || !child) continue;
    const payload: ChainPayload = { line: edge.line, direction: "parent" };
    newCards.push({
      type: "chain",
      prompt: `Ki volt ${child.name_hu} apja/anyja (${edge.line} vonal)?`,
      answer: parent.name_hu,
      answer_alt: [],
      distractors: [],
      payload,
      fact_id: null,
      entity_id: child.id,
      book_id: null,
      chapter: null,
      verse_ref: edge.verse_ref,
      difficulty: difficultyFor("chain", child, null),
      tags: [edge.line],
      source: "generated",
    });
  }

  // --- map (geo_places) ---------------------------------------------------
  for (const g of (geoPlaces ?? []) as GeoPlaceRow[]) {
    const entity = entityById.get(g.entity_id);
    if (!entity) continue;
    const payload: MapPayload = { svg_x: g.svg_x, svg_y: g.svg_y, tolerance: g.tolerance, place_type: g.place_type };
    newCards.push({
      type: "map",
      prompt: `Mutasd meg a térképen: ${entity.name_hu}`,
      answer: entity.name_hu,
      answer_alt: [],
      distractors: [],
      payload,
      fact_id: null,
      entity_id: entity.id,
      book_id: null,
      chapter: null,
      verse_ref: null,
      difficulty: difficultyFor("map", entity, null),
      tags: [],
      source: "generated",
    });
  }

  console.log(`Prepared ${newCards.length} cards. Inserting…`);
  const BATCH = 500;
  const insertedIds: number[] = [];
  for (let i = 0; i < newCards.length; i += BATCH) {
    const batch = newCards.slice(i, i + BATCH);
    const { data, error } = await supabaseAdmin.from("cards").insert(batch).select("id");
    if (error) throw error;
    for (const row of data ?? []) insertedIds.push(row.id);
    process.stdout.write(`\r  ${Math.min(i + BATCH, newCards.length)}/${newCards.length}`);
  }
  console.log("\nInitializing card_states for new cards…");
  const now = new Date().toISOString();
  for (let i = 0; i < insertedIds.length; i += BATCH) {
    const batch = insertedIds.slice(i, i + BATCH).map((card_id) => ({
      card_id,
      state: 0,
      due_at: now,
      reps: 0,
      lapses: 0,
      suspended: false,
    }));
    const { error } = await supabaseAdmin.from("card_states").insert(batch);
    if (error) throw error;
  }

  console.log(`Done. ${newCards.length} cards created.`);
}

function shuffleDeterministic<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const x = Math.sin(seed + i) * 10000;
    const j = Math.floor((x - Math.floor(x)) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
