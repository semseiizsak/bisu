import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type DB = SupabaseClient<Database>;

// Not "server-only" — this module is shared between the /api/pipeline/jit
// route (Next.js server context) and the standalone CLI scripts (plain
// Node via tsx), so it must not depend on Next's server-render boundary.
// Both call sites inject their own admin client instead.

const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `Te egy bibliai tény-kinyerő vagy. A megadott fejezetből strukturált
JSON-t adsz vissza. NEM értelmezel, NEM teologizálsz. Csak azt rögzíted,
ami szó szerint a szövegben áll.

Szabályok:
- Minden szám, méret, életkor, létszám külön fact.
- A fact_key legyen konzisztens snake_case magyar kulcs.
- confidence < 0.9, ha a szöveg homályos vagy több olvasata van.
- Ne találj ki semmit. Ha nincs adat, üres tömb.
- Válaszolj KIZÁRÓLAG a séma szerinti JSON-nal, magyarázat nélkül.`;

const RESPONSE_SCHEMA = `{
  "entities": [{ "type": "person|place|object|event|group|measurement|number|title", "name_hu": "", "aliases": [], "summary": "", "importance": 1 }],
  "facts": [{ "entity_name": "", "fact_key": "", "fact_value": "", "numeric_val": null, "unit": null, "verse_ref": "", "difficulty": 3, "confidence": 1.0 }],
  "timeline_events": [{ "label_hu": "", "era": "", "approx_year": null, "verse_ref": "", "importance": 3 }],
  "genealogy_edges": [{ "parent": "", "child": "", "line": "", "verse_ref": "" }]
}`;

export interface ExtractedEntity {
  type: string;
  name_hu: string;
  aliases?: string[];
  summary?: string;
  importance?: number;
}
export interface ExtractedFact {
  entity_name: string;
  fact_key: string;
  fact_value: string;
  numeric_val: number | null;
  unit: string | null;
  verse_ref: string;
  difficulty?: number;
  confidence?: number;
}
export interface ExtractedChapter {
  entities: ExtractedEntity[];
  facts: ExtractedFact[];
  timeline_events: Record<string, unknown>[];
  genealogy_edges: { parent: string; child: string; line: string; verse_ref: string }[];
}

/** One OpenAI call per chapter — same prompt/schema as the original
 * full-corpus batch job (scripts/extract-facts.ts), just callable per
 * chapter instead of only as part of a whole-book sweep. */
export async function extractChapterFacts(
  openai: OpenAI,
  bookShort: string,
  bookName: string,
  chapter: number,
  verses: { verse: number; text: string }[],
): Promise<ExtractedChapter> {
  const versesText = verses.map((v) => `${v.verse} ${v.text}`).join("\n");
  const completion = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Könyv: ${bookName} (${bookShort}) ${chapter}. fejezet\n\n${versesText}\n\nSéma:\n${RESPONSE_SCHEMA}` },
    ],
  });
  const text = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}

const GARBAGE_FACT_LIMIT = 200;

/**
 * Loads one already-extracted chapter's raw JSON into
 * entities/facts/timeline_events/genealogy_edges. Mirrors the per-file body
 * of scripts/extract-facts.ts's loadExtracted(), generalized to work from
 * an in-memory object instead of a data/extracted/*.json file — Vercel has
 * no persistent filesystem to cache through, so extraction_runs (the
 * caller's job) is the resumability layer instead.
 */
export async function loadExtractedChapter(
  admin: DB,
  bookId: number,
  chapter: number,
  raw: ExtractedChapter,
): Promise<{ factCount: number; skipped?: string }> {
  if ((raw.facts?.length ?? 0) > GARBAGE_FACT_LIMIT) {
    return { factCount: 0, skipped: `garbage guard: ${raw.facts.length} facts` };
  }

  const [{ data: existingEntities }, { data: suppressedRows }] = await Promise.all([
    admin.from("entities").select("id, name_hu"),
    admin.from("suppressed_fact_keys").select("fact_key"),
  ]);
  const entityCache = new Map((existingEntities ?? []).map((e) => [e.name_hu, e.id]));
  const suppressedKeys = new Set((suppressedRows ?? []).map((r) => r.fact_key));

  for (const e of raw.entities ?? []) {
    if (entityCache.has(e.name_hu)) continue;
    const { data, error } = await admin
      .from("entities")
      .insert({ type: e.type, name_hu: e.name_hu, aliases: e.aliases ?? [], summary: e.summary ?? null, importance: e.importance ?? 3 })
      .select("id")
      .single();
    if (error) throw error;
    entityCache.set(e.name_hu, data.id);
  }

  const factRows = (raw.facts ?? [])
    .filter((f) => entityCache.has(f.entity_name))
    .map((f) => ({
      entity_id: entityCache.get(f.entity_name),
      fact_key: f.fact_key,
      fact_value: f.fact_value,
      numeric_val: f.numeric_val ?? null,
      unit: f.unit ?? null,
      verse_ref: f.verse_ref,
      book_id: bookId,
      chapter,
      difficulty: f.difficulty ?? 3,
      confidence: f.confidence ?? 1.0,
      verified: (f.confidence ?? 1.0) >= 0.9,
      suppressed: suppressedKeys.has(f.fact_key),
    }));
  if (factRows.length) {
    const { error } = await admin.from("facts").insert(factRows);
    if (error) throw error;
  }

  if (raw.timeline_events?.length) {
    const { error } = await admin
      .from("timeline_events")
      .insert(raw.timeline_events.map((t, i) => ({ ...t, order_idx: (t as { order_idx?: number }).order_idx ?? i })) as Database["public"]["Tables"]["timeline_events"]["Insert"][]);
    if (error) console.warn("timeline_events insert warning:", error.message);
  }

  if (raw.genealogy_edges?.length) {
    const edgeRows = raw.genealogy_edges
      .filter((g) => entityCache.has(g.parent) && entityCache.has(g.child))
      .map((g) => ({ parent_id: entityCache.get(g.parent)!, child_id: entityCache.get(g.child)!, line: g.line, verse_ref: g.verse_ref }));
    if (edgeRows.length) {
      const { error } = await admin.from("genealogy_edges").insert(edgeRows);
      if (error) throw error;
    }
  }

  return { factCount: factRows.length };
}
