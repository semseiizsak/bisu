/**
 * Full-corpus entity/fact extraction (Phase 1, section 4.2 of the handoff).
 * Runs one OpenAI call per chapter (1189 total), 5-way concurrent, writes raw
 * JSON to data/extracted/{book}-{chapter}.json before touching the DB so the
 * run is resumable and re-runnable.
 *
 * Requires OPENAI_API_KEY in .env.local. Not run automatically — this is
 * a deliberate, costly, long batch job the operator kicks off by hand:
 *
 *   npx tsx scripts/extract-facts.ts
 *   npx tsx scripts/extract-facts.ts --book genesis          # single book
 *   npx tsx scripts/extract-facts.ts --load                  # load already-extracted JSON into the DB
 */
import OpenAI from "openai";
import pLimit from "p-limit";
import { config } from "dotenv";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { BOOKS } from "../src/lib/content/books";
import { supabaseAdmin } from "./lib/supabase-admin";

config({ path: resolve(process.cwd(), ".env.local") });

const MODEL = "gpt-4o-mini"; // cost-efficient, JSON-mode capable — swap here if you want a different model
const CONCURRENCY = 5;
const OUT_DIR = resolve(process.cwd(), "data/extracted");

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

interface ExtractedChapter {
  entities: unknown[];
  facts: unknown[];
  timeline_events: unknown[];
  genealogy_edges: unknown[];
}

async function extractChapter(
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
      {
        role: "user",
        content: `Könyv: ${bookName} (${bookShort}) ${chapter}. fejezet\n\n${versesText}\n\nSéma:\n${RESPONSE_SCHEMA}`,
      },
    ],
  });
  const text = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}

async function runExtraction(bookFilter?: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing in .env.local");
  const openai = new OpenAI({ apiKey });

  const { data: dbBooks, error } = await supabaseAdmin.from("books").select("id, slug, short_hu, name_hu");
  if (error) throw error;
  const booksToRun = BOOKS.filter((b) => !bookFilter || b.slug === bookFilter);

  await mkdir(OUT_DIR, { recursive: true });
  const limit = pLimit(CONCURRENCY);

  for (const book of booksToRun) {
    const dbBook = dbBooks!.find((b) => b.slug === book.slug);
    if (!dbBook) throw new Error(`Book not found in DB: ${book.slug}. Run import-bible.ts first.`);

    const { data: verses, error: vErr } = await supabaseAdmin
      .from("verses")
      .select("chapter, verse, text")
      .eq("book_id", dbBook.id)
      .order("chapter")
      .order("verse");
    if (vErr) throw vErr;

    const byChapter = new Map<number, { verse: number; text: string }[]>();
    for (const v of verses ?? []) {
      if (!byChapter.has(v.chapter)) byChapter.set(v.chapter, []);
      byChapter.get(v.chapter)!.push({ verse: v.verse, text: v.text });
    }

    const tasks = Array.from(byChapter.entries()).map(([chapter, chVerses]) =>
      limit(async () => {
        const outPath = resolve(OUT_DIR, `${book.slug}-${chapter}.json`);
        try {
          await readFile(outPath, "utf-8");
          console.log(`skip (cached): ${book.slug} ${chapter}`);
          return;
        } catch {
          // not cached yet
        }
        console.log(`extracting: ${book.slug} ${chapter}`);
        const result = await extractChapter(openai, book.short_hu, book.name_hu, chapter, chVerses);
        await writeFile(outPath, JSON.stringify(result, null, 2), "utf-8");
      }),
    );
    await Promise.all(tasks);
  }
  console.log("Extraction complete. Run `npx tsx scripts/extract-facts.ts --load` to import into the DB.");
}

async function loadExtracted() {
  const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith(".json"));
  console.log(`Loading ${files.length} extracted chapter files into the DB…`);

  const entityCache = new Map<string, number>();
  const { data: existing } = await supabaseAdmin.from("entities").select("id, name_hu");
  for (const e of existing ?? []) entityCache.set(e.name_hu, e.id);

  const { data: dbBooks } = await supabaseAdmin.from("books").select("id, slug, short_hu");

  // Facts born under a fact_key the user has asked to suppress everywhere
  // ("Minden hasonló elrejtése") should never surface, even freshly extracted.
  const { data: suppressedRows } = await supabaseAdmin.from("suppressed_fact_keys").select("fact_key");
  const suppressedKeys = new Set((suppressedRows ?? []).map((r) => r.fact_key));

  for (const file of files) {
    const [, bookSlug, chapterStr] = file.match(/^(.+)-(\d+)\.json$/) ?? [];
    if (!bookSlug) continue;
    const chapter = Number(chapterStr);
    const raw = JSON.parse(await readFile(resolve(OUT_DIR, file), "utf-8"));

    for (const e of raw.entities ?? []) {
      if (entityCache.has(e.name_hu)) continue;
      const { data, error } = await supabaseAdmin
        .from("entities")
        .insert({
          type: e.type,
          name_hu: e.name_hu,
          aliases: e.aliases ?? [],
          summary: e.summary ?? null,
          importance: e.importance ?? 3,
        })
        .select("id")
        .single();
      if (error) throw error;
      entityCache.set(e.name_hu, data.id);
    }

    const dbBook = dbBooks!.find((b) => b.slug === bookSlug);
    const factRows = (raw.facts ?? [])
      .filter((f: { entity_name: string }) => entityCache.has(f.entity_name))
      .map((f: { entity_name: string; fact_key: string; fact_value: string; numeric_val: number | null; unit: string | null; verse_ref: string; difficulty: number; confidence: number }) => ({
        entity_id: entityCache.get(f.entity_name),
        fact_key: f.fact_key,
        fact_value: f.fact_value,
        numeric_val: f.numeric_val ?? null,
        unit: f.unit ?? null,
        verse_ref: f.verse_ref,
        book_id: dbBook?.id ?? null,
        chapter,
        difficulty: f.difficulty ?? 3,
        confidence: f.confidence ?? 1.0,
        verified: (f.confidence ?? 1.0) >= 0.9,
        suppressed: suppressedKeys.has(f.fact_key),
      }));
    if (factRows.length) {
      const { error } = await supabaseAdmin.from("facts").insert(factRows);
      if (error) throw error;
    }

    if (raw.timeline_events?.length) {
      const { error } = await supabaseAdmin.from("timeline_events").insert(
        raw.timeline_events.map((t: Record<string, unknown>, i: number) => ({ ...t, order_idx: t.order_idx ?? i })),
      );
      if (error) console.warn(`timeline_events insert warning for ${file}:`, error.message);
    }

    if (raw.genealogy_edges?.length) {
      const edgeRows = raw.genealogy_edges
        .filter((g: { parent: string; child: string }) => entityCache.has(g.parent) && entityCache.has(g.child))
        .map((g: { parent: string; child: string; line: string; verse_ref: string }) => ({
          parent_id: entityCache.get(g.parent),
          child_id: entityCache.get(g.child),
          line: g.line,
          verse_ref: g.verse_ref,
        }));
      if (edgeRows.length) {
        const { error } = await supabaseAdmin.from("genealogy_edges").insert(edgeRows);
        if (error) throw error;
      }
    }
  }
  console.log("Load complete.");
}

const args = process.argv.slice(2);
const bookFlagIdx = args.indexOf("--book");
const bookFilter = bookFlagIdx >= 0 ? args[bookFlagIdx + 1] : undefined;

if (args.includes("--load")) {
  loadExtracted().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  runExtraction(bookFilter).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
