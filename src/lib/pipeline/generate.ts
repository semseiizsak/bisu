import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { calibrateDifficulty, type CardType } from "@/lib/content/difficulty";
import type { OrderPayload, LocatePayload, ChainPayload, MapPayload } from "@/lib/content/card-payloads";

type DB = SupabaseClient<Database>;

interface EntityRow {
  id: number;
  type: string;
  name_hu: string;
  importance: number;
  ref_count: number;
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
  prompt_raw: string;
  answer: string;
  answer_alt: string[];
  distractors: string[];
  payload: object | null;
  entity_id: number | null;
  book_id: number | null;
  chapter: number | null;
  verse_ref: string | null;
  difficulty: number;
  tags: string[];
  source: string;
}

/**
 * Deterministic generator for the GAME-ONLY card types: locate (verse →
 * book/chapter), order (timeline), chain (genealogy) and map (geo). These
 * never enter the quiz; the quiz is built from `question` cards produced by
 * src/lib/pipeline/questions.ts. Idempotent: skips anything that already
 * has a card.
 */
export async function generateGameCards(admin: DB): Promise<{ cardsCreated: number }> {
  const [{ data: entities }, { data: books }, { data: timelineEvents }, { data: genealogyEdges }, { data: geoPlaces }, { data: verses }] =
    await Promise.all([
      admin.from("entities").select("id, type, name_hu, importance, ref_count"),
      admin.from("books").select("id, slug, short_hu"),
      admin.from("timeline_events").select("id, label_hu, era, order_idx, verse_ref").order("order_idx"),
      admin.from("genealogy_edges").select("id, parent_id, child_id, line, verse_ref"),
      admin.from("geo_places").select("id, entity_id, svg_x, svg_y, place_type, tolerance"),
      admin.from("verses").select("id, book_id, chapter, verse, text").eq("verse", 1),
    ]);

  const entityById = new Map((entities as EntityRow[]).map((e) => [e.id, e]));
  const bookById = new Map((books as BookRow[]).map((b) => [b.id, b]));

  const { data: existingCards } = await admin
    .from("cards")
    .select("type, entity_id, book_id, chapter, answer, tags")
    .in("type", ["locate", "order", "chain", "map"]);
  const existingKey = new Set<string>();
  for (const c of existingCards ?? []) {
    if (c.type === "locate") existingKey.add(`locate:${c.book_id}:${c.chapter}`);
    else if (c.type === "order") existingKey.add(`order:${c.answer}`);
    else if (c.type === "chain") existingKey.add(`chain:${c.entity_id}:${(c.tags ?? []).join(",")}`);
    else if (c.type === "map") existingKey.add(`map:${c.entity_id}`);
  }

  const newCards: NewCard[] = [];

  // --- locate (first verse of each chapter -> book/chapter) ----------------
  for (const v of (verses ?? []) as VerseRow[]) {
    const book = bookById.get(v.book_id);
    if (!book) continue;
    if (existingKey.has(`locate:${v.book_id}:${v.chapter}`)) continue;
    const payload: LocatePayload = { verse_text: v.text, book_id: v.book_id, chapter: v.chapter };
    newCards.push({
      type: "locate",
      prompt: v.text,
      prompt_raw: v.text,
      answer: `${book.short_hu} ${v.chapter}`,
      answer_alt: [],
      distractors: [],
      payload,
      entity_id: null,
      book_id: v.book_id,
      chapter: v.chapter,
      verse_ref: `${book.short_hu} ${v.chapter}:${v.verse}`,
      difficulty: 3,
      tags: [],
      source: "generated",
    });
  }

  // --- order (timeline_events grouped by era, chunks of 6) -----------------
  const eventsByEra = new Map<string, TimelineEventRow[]>();
  for (const t of (timelineEvents ?? []) as TimelineEventRow[]) {
    if (!eventsByEra.has(t.era)) eventsByEra.set(t.era, []);
    eventsByEra.get(t.era)!.push(t);
  }
  for (const [era, events] of eventsByEra) {
    for (let i = 0; i < events.length; i += 6) {
      const chunk = events.slice(i, i + 6);
      if (chunk.length < 3) continue;
      const answer = chunk.map((e) => e.id).join(",");
      if (existingKey.has(`order:${answer}`)) continue;
      const payload: OrderPayload = { items: chunk.map((e) => ({ id: e.id, label: e.label_hu })), correct_order: chunk.map((e) => e.id) };
      newCards.push({
        type: "order",
        prompt: `Állítsd időrendbe (${era})`,
        prompt_raw: `Állítsd időrendbe (${era})`,
        answer,
        answer_alt: [],
        distractors: [],
        payload,
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

  // --- chain (genealogy edges) ----------------------------------------------
  for (const edge of (genealogyEdges ?? []) as GenealogyEdgeRow[]) {
    const parent = entityById.get(edge.parent_id);
    const child = entityById.get(edge.child_id);
    if (!parent || !child) continue;
    if (existingKey.has(`chain:${child.id}:${edge.line}`)) continue;
    const payload: ChainPayload = { line: edge.line, direction: "parent" };
    newCards.push({
      type: "chain",
      prompt: `Ki volt ${child.name_hu} apja (${edge.line} vonal)?`,
      prompt_raw: `Ki volt ${child.name_hu} apja (${edge.line} vonal)?`,
      answer: parent.name_hu,
      answer_alt: [],
      distractors: [],
      payload,
      entity_id: child.id,
      book_id: null,
      chapter: null,
      verse_ref: edge.verse_ref,
      difficulty: calibrateDifficulty({ entityImportance: child.importance, entityRefCount: child.ref_count, numericVal: null, type: "chain" }),
      tags: [edge.line],
      source: "generated",
    });
  }

  // --- map (geo_places) -----------------------------------------------------
  for (const g of (geoPlaces ?? []) as GeoPlaceRow[]) {
    const entity = entityById.get(g.entity_id);
    if (!entity) continue;
    if (existingKey.has(`map:${entity.id}`)) continue;
    const payload: MapPayload = { svg_x: g.svg_x, svg_y: g.svg_y, tolerance: g.tolerance, place_type: g.place_type };
    newCards.push({
      type: "map",
      prompt: `Mutasd meg a térképen: ${entity.name_hu}`,
      prompt_raw: `Mutasd meg a térképen: ${entity.name_hu}`,
      answer: entity.name_hu,
      answer_alt: [],
      distractors: [],
      payload,
      entity_id: entity.id,
      book_id: null,
      chapter: null,
      verse_ref: null,
      difficulty: calibrateDifficulty({ entityImportance: entity.importance, entityRefCount: entity.ref_count, numericVal: null, type: "map" }),
      tags: [],
      source: "generated",
    });
  }

  const BATCH = 500;
  const insertedIds: number[] = [];
  for (let i = 0; i < newCards.length; i += BATCH) {
    const batch = newCards.slice(i, i + BATCH);
    const { data, error } = await admin
      .from("cards")
      .insert(batch as unknown as Database["public"]["Tables"]["cards"]["Insert"][])
      .select("id");
    if (error) throw error;
    for (const row of data ?? []) insertedIds.push(row.id);
  }
  const now = new Date().toISOString();
  for (let i = 0; i < insertedIds.length; i += BATCH) {
    const batch = insertedIds.slice(i, i + BATCH).map((card_id) => ({ card_id, state: 0, due_at: now, reps: 0, lapses: 0, suspended: false }));
    const { error } = await admin.from("card_states").insert(batch);
    if (error) throw error;
  }

  return { cardsCreated: newCards.length };
}
