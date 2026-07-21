/**
 * Full-corpus entity/fact extraction (Phase 1, section 4.2 of the handoff).
 * Runs one OpenAI call per chapter, 5-way concurrent, writes raw JSON to
 * data/extracted/{book}-{chapter}.json before touching the DB so the run
 * is resumable and re-runnable. The extraction call and DB-load logic are
 * shared with the JIT pipeline (src/lib/pipeline/extract.ts) — this script
 * adds the file-cache layer for a large one-off batch job, on top of it.
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
import { extractChapterFacts, loadExtractedChapter, type ExtractedChapter } from "../src/lib/pipeline/extract";
import { supabaseAdmin } from "./lib/supabase-admin";

config({ path: resolve(process.cwd(), ".env.local") });

const CONCURRENCY = 5;
const OUT_DIR = resolve(process.cwd(), "data/extracted");

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
        const result = await extractChapterFacts(openai, book.short_hu, book.name_hu, chapter, chVerses);
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

  const { data: dbBooks } = await supabaseAdmin.from("books").select("id, slug");
  const bookIdBySlug = new Map((dbBooks ?? []).map((b) => [b.slug, b.id]));

  let totalFacts = 0;
  for (const file of files) {
    const [, bookSlug, chapterStr] = file.match(/^(.+)-(\d+)\.json$/) ?? [];
    if (!bookSlug) continue;
    const chapter = Number(chapterStr);
    const bookId = bookIdBySlug.get(bookSlug);
    if (!bookId) {
      console.warn(`skip ${file}: book not found in DB`);
      continue;
    }
    const raw = JSON.parse(await readFile(resolve(OUT_DIR, file), "utf-8")) as ExtractedChapter;
    const { factCount, skipped } = await loadExtractedChapter(supabaseAdmin, bookId, chapter, raw);
    if (skipped) console.warn(`${file}: ${skipped}`);
    totalFacts += factCount;
  }
  console.log(`Load complete. ${totalFacts} facts inserted.`);
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
