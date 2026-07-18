/**
 * Coverage check (section 5.4). Reports chapters with fewer than 5 active
 * cards so they can be prioritized for extraction/generation. Dense
 * chapters (2Móz 25-31/35-40, 1Kir 6-7, Ez 40-48) should have 30+.
 *
 * Usage: npx tsx scripts/check-coverage.ts
 */
import { BOOKS } from "../src/lib/content/books";
import { supabaseAdmin } from "./lib/supabase-admin";

const DENSE_CHAPTERS: Record<string, [number, number]> = {
  exodus: [25, 31],
  "1kings": [6, 7],
  ezekiel: [40, 48],
};

async function main() {
  const { data: books } = await supabaseAdmin.from("books").select("id, slug, short_hu, chapters_count");
  const { data: cards } = await supabaseAdmin.from("cards").select("book_id, chapter").eq("active", true);

  const countByBookChapter = new Map<string, number>();
  for (const c of cards ?? []) {
    if (c.book_id == null || c.chapter == null) continue;
    const key = `${c.book_id}:${c.chapter}`;
    countByBookChapter.set(key, (countByBookChapter.get(key) ?? 0) + 1);
  }

  const underCovered: string[] = [];
  const denseUnderCovered: string[] = [];

  for (const dbBook of books ?? []) {
    const def = BOOKS.find((b) => b.slug === dbBook.slug);
    if (!def) continue;
    const denseRange = DENSE_CHAPTERS[dbBook.slug];
    for (let ch = 1; ch <= dbBook.chapters_count; ch++) {
      const count = countByBookChapter.get(`${dbBook.id}:${ch}`) ?? 0;
      const isDense = denseRange && ch >= denseRange[0] && ch <= denseRange[1];
      const threshold = isDense ? 30 : 5;
      if (count < threshold) {
        const line = `${dbBook.short_hu} ${ch}: ${count} kártya (küszöb: ${threshold})`;
        if (isDense) denseUnderCovered.push(line);
        else underCovered.push(line);
      }
    }
  }

  console.log(`Összes aktív kártya: ${cards?.length ?? 0}`);
  console.log(`\nSűrű fejezetek (30+ küszöb) hiánya: ${denseUnderCovered.length}`);
  denseUnderCovered.forEach((l) => console.log("  " + l));
  console.log(`\nÁltalános fejezetek (5+ küszöb) hiánya: ${underCovered.length}`);
  underCovered.slice(0, 50).forEach((l) => console.log("  " + l));
  if (underCovered.length > 50) console.log(`  … és még ${underCovered.length - 50}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
