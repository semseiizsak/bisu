/**
 * Coverage check: reports chapters with fewer than MIN_QUESTIONS active
 * question cards, and chapters whose generation run ended in an error, so
 * they can be re-run with scripts/generate-questions.ts --force.
 *
 * Usage: npx tsx scripts/check-coverage.ts
 */
import { BOOKS } from "../src/lib/content/books";
import { supabaseAdmin } from "./lib/supabase-admin";

const MIN_QUESTIONS = 3;

async function main() {
  const [{ data: books }, { data: cards }, { data: runs }] = await Promise.all([
    supabaseAdmin.from("books").select("id, slug, short_hu, chapters_count"),
    supabaseAdmin.from("cards").select("book_id, chapter").eq("active", true).eq("type", "question"),
    supabaseAdmin.from("extraction_runs").select("book_slug, chapter, status, error").eq("kind", "questions"),
  ]);

  const countByBookChapter = new Map<string, number>();
  for (const c of cards ?? []) {
    if (c.book_id == null || c.chapter == null) continue;
    const key = `${c.book_id}:${c.chapter}`;
    countByBookChapter.set(key, (countByBookChapter.get(key) ?? 0) + 1);
  }
  const runByKey = new Map((runs ?? []).map((r) => [`${r.book_slug}:${r.chapter}`, r]));

  const underCovered: string[] = [];
  const errored: string[] = [];
  let notRun = 0;

  for (const dbBook of books ?? []) {
    const def = BOOKS.find((b) => b.slug === dbBook.slug);
    if (!def) continue;
    for (let ch = 1; ch <= dbBook.chapters_count; ch++) {
      const run = runByKey.get(`${dbBook.slug}:${ch}`);
      if (!run) {
        notRun++;
        continue;
      }
      if (run.status === "error") {
        errored.push(`${dbBook.short_hu} ${ch}: ${run.error ?? "error"}`);
        continue;
      }
      const count = countByBookChapter.get(`${dbBook.id}:${ch}`) ?? 0;
      if (count < MIN_QUESTIONS) underCovered.push(`${dbBook.short_hu} ${ch}: ${count} kérdés`);
    }
  }

  console.log(`Aktív kérdések: ${cards?.length ?? 0}`);
  console.log(`Még nem generált fejezetek: ${notRun}`);
  console.log(`\nHibára futott fejezetek: ${errored.length}`);
  errored.slice(0, 50).forEach((l) => console.log("  " + l));
  console.log(`\nKevés kérdésű fejezetek (<${MIN_QUESTIONS}): ${underCovered.length}`);
  underCovered.slice(0, 50).forEach((l) => console.log("  " + l));
  if (underCovered.length > 50) console.log(`  … és még ${underCovered.length - 50}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
