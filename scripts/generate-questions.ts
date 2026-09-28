/**
 * Batch question + study-note generation (one model call per chapter).
 *
 * Resumable: chapters with an extraction_runs row (kind = 'questions') are
 * skipped unless --force. Raw model output is cached under data/questions/
 * so a re-load never pays for the same chapter twice.
 *
 *   npx tsx scripts/generate-questions.ts                    # everything in the reading plan order
 *   npx tsx scripts/generate-questions.ts --book genesis     # one book
 *   npx tsx scripts/generate-questions.ts --book genesis --chapter 4 --print
 *   npx tsx scripts/generate-questions.ts --upcoming         # same window the cron covers
 *   npx tsx scripts/generate-questions.ts --book ruth --force
 *
 * Requires OPENAI_API_KEY (and optionally OPENAI_QUESTION_MODEL) in .env.local.
 */
import OpenAI from "openai";
import { config } from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pLimit from "p-limit";
import { BOOKS } from "../src/lib/content/books";
import { generateChapterContent, loadChapterContent, questionModel, type RawChapterContent } from "../src/lib/pipeline/questions";
import { filterUncovered, upcomingUncoveredChapters, PIPELINE_KIND, type ChapterTarget } from "../src/lib/pipeline/run";
import { supabaseAdmin } from "./lib/supabase-admin";

config({ path: resolve(process.cwd(), ".env.local") });

const OUT_DIR = resolve(process.cwd(), "data/questions");
const CONCURRENCY = 3;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const bookFilter = flag("--book");
const chapterFilter = flag("--chapter") ? Number(flag("--chapter")) : undefined;
const force = args.includes("--force");
const print = args.includes("--print");
const upcoming = args.includes("--upcoming");

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing in .env.local");
  const openai = new OpenAI({ apiKey });
  const model = questionModel();

  const { data: dbBooks, error } = await supabaseAdmin.from("books").select("id, slug, short_hu, name_hu, order_idx, chapters_count");
  if (error) throw error;
  const bookBySlug = new Map((dbBooks ?? []).map((b) => [b.slug, b]));

  let targets: ChapterTarget[] = [];
  if (upcoming) {
    targets = await upcomingUncoveredChapters(supabaseAdmin, 7);
  } else {
    for (const def of BOOKS) {
      if (bookFilter && def.slug !== bookFilter) continue;
      const book = bookBySlug.get(def.slug);
      if (!book) throw new Error(`Book not in DB: ${def.slug}. Run import-bible.ts first.`);
      for (let ch = 1; ch <= book.chapters_count; ch++) {
        if (chapterFilter && ch !== chapterFilter) continue;
        targets.push({ book_slug: def.slug, chapter: ch });
      }
    }
    if (!force) targets = await filterUncovered(supabaseAdmin, targets);
  }

  console.log(`${targets.length} chapter(s) to process with ${model}.`);
  await mkdir(OUT_DIR, { recursive: true });
  const limit = pLimit(CONCURRENCY);
  let totalCards = 0;

  await Promise.all(
    targets.map((t) =>
      limit(async () => {
        const book = bookBySlug.get(t.book_slug)!;
        const cachePath = resolve(OUT_DIR, `${t.book_slug}-${t.chapter}.json`);
        let raw: RawChapterContent | null = null;
        if (!force) {
          try {
            raw = JSON.parse(await readFile(cachePath, "utf-8")) as RawChapterContent;
          } catch {
            raw = null;
          }
        }
        if (!raw) {
          const { data: verses } = await supabaseAdmin.from("verses").select("verse, text").eq("book_id", book.id).eq("chapter", t.chapter).order("verse");
          if (!verses?.length) {
            console.warn(`skip ${t.book_slug} ${t.chapter}: no verses`);
            return;
          }
          process.stdout.write(`generating ${book.short_hu} ${t.chapter}… `);
          raw = await generateChapterContent(openai, book.name_hu, book.short_hu, t.chapter, verses, model);
          await writeFile(cachePath, JSON.stringify(raw, null, 2), "utf-8");
        } else {
          process.stdout.write(`loading cached ${book.short_hu} ${t.chapter}… `);
        }

        const loaded = await loadChapterContent(supabaseAdmin, book, t.chapter, raw, model);
        totalCards += loaded.cardsCreated;
        await supabaseAdmin.from("extraction_runs").upsert(
          { book_slug: t.book_slug, chapter: t.chapter, kind: PIPELINE_KIND, status: "done", fact_count: loaded.cardsCreated, model, created_at: new Date().toISOString() },
          { onConflict: "book_slug,chapter,kind" },
        );
        console.log(`${loaded.cardsCreated} card(s), ${loaded.report.rejected.length} rejected${loaded.cardsSkipped ? `, ${loaded.cardsSkipped} already present` : ""}`);

        if (print) {
          for (const q of loaded.report.accepted) {
            console.log(`  [${q.kind}/${q.difficulty}] ${q.question}`);
            console.log(`      → ${q.answer}   (${q.distractors.join(" | ")})`);
            console.log(`      ${q.why}`);
          }
          for (const r of loaded.report.rejected) console.log(`  ✗ ${r.reason}: ${r.question.question}`);
        }
      }),
    ),
  );

  console.log(`Done. ${totalCards} question card(s) created.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
