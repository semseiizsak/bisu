/**
 * Imports the Károli 1908 (public domain) text into `books` + `verses`.
 * Source: api.getbible.net/v2/karoli.json — cached locally after first fetch.
 *
 * Usage: npx tsx scripts/import-bible.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { BOOKS } from "../src/lib/content/books";
import { supabaseAdmin } from "./lib/supabase-admin";

const SOURCE_URL = "https://api.getbible.net/v2/karoli.json";
const CACHE_PATH = resolve(process.cwd(), "data/raw/karoli.json");

interface RawVerse {
  chapter: number;
  verse: number;
  text: string;
}
interface RawChapter {
  chapter: number;
  verses: RawVerse[];
}
interface RawBook {
  nr: number | null;
  name: string;
  chapters: RawChapter[];
}
interface RawBible {
  books: RawBook[];
}

async function loadSource(): Promise<RawBible> {
  try {
    const cached = await readFile(CACHE_PATH, "utf-8");
    console.log("Using cached source at", CACHE_PATH);
    return JSON.parse(cached);
  } catch {
    console.log("Fetching source from", SOURCE_URL);
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`Failed to fetch source: ${res.status}`);
    const json = await res.text();
    await mkdir(dirname(CACHE_PATH), { recursive: true });
    await writeFile(CACHE_PATH, json, "utf-8");
    return JSON.parse(json);
  }
}

async function main() {
  const source = await loadSource();

  if (source.books.length !== BOOKS.length) {
    throw new Error(
      `Book count mismatch: source has ${source.books.length}, BOOKS has ${BOOKS.length}`,
    );
  }

  console.log("Upserting books…");
  const bookRows = BOOKS.map((b, i) => ({
    slug: b.slug,
    name_hu: b.name_hu,
    short_hu: b.short_hu,
    testament: b.testament,
    order_idx: b.order_idx,
    genre: b.genre,
    chapters_count: source.books[i].chapters.length,
  }));

  const { error: booksError } = await supabaseAdmin
    .from("books")
    .upsert(bookRows, { onConflict: "slug" });
  if (booksError) throw booksError;

  const { data: dbBooks, error: fetchError } = await supabaseAdmin
    .from("books")
    .select("id, slug");
  if (fetchError) throw fetchError;
  const idBySlug = new Map(dbBooks!.map((b) => [b.slug, b.id]));

  console.log("Building verse rows…");
  const verseRows: { book_id: number; chapter: number; verse: number; text: string }[] = [];
  for (let i = 0; i < BOOKS.length; i++) {
    const bookId = idBySlug.get(BOOKS[i].slug);
    if (!bookId) throw new Error(`Missing book id for ${BOOKS[i].slug}`);
    for (const chapter of source.books[i].chapters) {
      for (const v of chapter.verses) {
        verseRows.push({
          book_id: bookId,
          chapter: v.chapter,
          verse: v.verse,
          text: v.text.trim(),
        });
      }
    }
  }
  console.log(`Prepared ${verseRows.length} verses. Upserting in batches…`);

  const BATCH = 1000;
  for (let i = 0; i < verseRows.length; i += BATCH) {
    const batch = verseRows.slice(i, i + BATCH);
    const { error } = await supabaseAdmin
      .from("verses")
      .upsert(batch, { onConflict: "book_id,chapter,verse" });
    if (error) throw error;
    process.stdout.write(`\r  ${Math.min(i + BATCH, verseRows.length)}/${verseRows.length}`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
