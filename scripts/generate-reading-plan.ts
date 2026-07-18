/**
 * Generates the 365-day reading plan (Phase 4, section 7.1).
 *
 * Phase 1 (days 1-60):   Torah + Gospels/Acts — the skeleton.
 * Phase 2 (days 61-200): the rest of the Old Testament — deepest dive.
 * Phase 3 (days 201-300): Epistles + Revelation.
 * Phase 4 (days 301-365): full speed re-read, zero new cards (handled by
 *                          the session builder, not this script).
 *
 * Each phase's books are split evenly (by verse count) across its day
 * range, then a smoothing pass caps any day at 55 minutes of reading by
 * cascading overflow chapters into the next day — see section 6.3's rule
 * and 6.5's "never let a day exceed the cap" directive.
 *
 * Usage: npx tsx scripts/generate-reading-plan.ts
 */
import { BOOKS } from "../src/lib/content/books";
import { estimateReadingMinutes } from "../src/lib/session/time-estimates";
import { focusNoteFor } from "../src/lib/content/focus-notes";
import { supabaseAdmin } from "./lib/supabase-admin";

const HARD_CAP_MINUTES = 55;

const PHASE_1_SLUGS = ["genesis", "exodus", "leviticus", "numbers", "deuteronomy", "matthew", "mark", "luke", "john", "acts"];
const PHASE_1_RANGE: [number, number] = [1, 60];
const PHASE_3_EXTRA_SLUGS = new Set([
  "romans", "1corinthians", "2corinthians", "galatians", "ephesians", "philippians", "colossians",
  "1thessalonians", "2thessalonians", "1timothy", "2timothy", "titus", "philemon", "hebrews",
  "james", "1peter", "2peter", "1john", "2john", "3john", "jude", "revelation",
]);
const PHASE_3_RANGE: [number, number] = [201, 300];
const PHASE_2_RANGE: [number, number] = [61, 200];
const PHASE_4_RANGE: [number, number] = [301, 365];

interface ChapterInfo {
  book_slug: string;
  chapter: number;
  verse_count: number;
}
interface DaySegment {
  book_slug: string;
  ch_from: number;
  ch_to: number;
}
interface DayPlan {
  day_idx: number;
  phase: number;
  segments: DaySegment[];
  est_minutes: number;
  focus_note: string | null;
}

function mergeToSegments(chapters: ChapterInfo[]): DaySegment[] {
  const segments: DaySegment[] = [];
  for (const c of chapters) {
    const last = segments[segments.length - 1];
    if (last && last.book_slug === c.book_slug && last.ch_to === c.chapter - 1) {
      last.ch_to = c.chapter;
    } else {
      segments.push({ book_slug: c.book_slug, ch_from: c.chapter, ch_to: c.chapter });
    }
  }
  return segments;
}

/** Splits a chapter queue into exactly `numDays` day-buckets by cumulative verse-count boundaries. */
function splitIntoDays(queue: ChapterInfo[], numDays: number): ChapterInfo[][] {
  const totalVerses = queue.reduce((s, c) => s + c.verse_count, 0);
  const days: ChapterInfo[][] = [];
  let cumulative = 0;
  let i = 0;
  for (let day = 0; day < numDays; day++) {
    const boundary = Math.round(((day + 1) / numDays) * totalVerses);
    const bucket: ChapterInfo[] = [];
    while (i < queue.length && (cumulative < boundary || bucket.length === 0)) {
      bucket.push(queue[i]);
      cumulative += queue[i].verse_count;
      i++;
      if (cumulative >= boundary) break;
    }
    days.push(bucket);
  }
  // Any leftover chapters (rounding) go to the last day.
  while (i < queue.length) {
    days[days.length - 1].push(queue[i]);
    i++;
  }
  return days;
}

/** Cascades chapters from over-cap days into the following day. */
function smoothCap(days: ChapterInfo[][]): void {
  for (let d = 0; d < days.length - 1; d++) {
    let minutes = estimateReadingMinutes(days[d].reduce((s, c) => s + c.verse_count, 0));
    while (minutes > HARD_CAP_MINUTES && days[d].length > 1) {
      const moved = days[d].pop()!;
      days[d + 1].unshift(moved);
      minutes = estimateReadingMinutes(days[d].reduce((s, c) => s + c.verse_count, 0));
    }
  }
}

function buildPhaseDays(queue: ChapterInfo[], range: [number, number], phase: number): DayPlan[] {
  const numDays = range[1] - range[0] + 1;
  const days = splitIntoDays(queue, numDays);
  smoothCap(days);

  return days.map((chapters, i) => {
    const segments = mergeToSegments(chapters);
    const verseCount = chapters.reduce((s, c) => s + c.verse_count, 0);
    const est_minutes = Math.round(estimateReadingMinutes(verseCount));
    const focus_note = segments
      .map((s) => focusNoteFor(s.book_slug, s.ch_from, s.ch_to))
      .find((n) => n != null) ?? null;
    return { day_idx: range[0] + i, phase, segments, est_minutes, focus_note };
  });
}

async function main() {
  const { data: books } = await supabaseAdmin.from("books").select("id, slug, chapters_count");
  const { data: verses } = await supabaseAdmin.from("verses").select("book_id, chapter");
  if (!books || !verses) throw new Error("Run scripts/import-bible.ts first.");
  const bookRows = books;

  const versesPerChapter = new Map<string, number>();
  const bookIdToSlug = new Map(bookRows.map((b) => [b.id, b.slug]));
  for (const v of verses) {
    const slug = bookIdToSlug.get(v.book_id);
    if (!slug) continue;
    const key = `${slug}:${v.chapter}`;
    versesPerChapter.set(key, (versesPerChapter.get(key) ?? 0) + 1);
  }

  function chapterQueue(slugs: string[]): ChapterInfo[] {
    const orderedSlugs = BOOKS.filter((b) => slugs.includes(b.slug)).map((b) => b.slug);
    const queue: ChapterInfo[] = [];
    for (const slug of orderedSlugs) {
      const book = bookRows.find((b) => b.slug === slug)!;
      for (let ch = 1; ch <= book.chapters_count; ch++) {
        queue.push({ book_slug: slug, chapter: ch, verse_count: versesPerChapter.get(`${slug}:${ch}`) ?? 20 });
      }
    }
    return queue;
  }

  const allOtSlugs = BOOKS.filter((b) => b.testament === "OT").map((b) => b.slug);
  const phase2Slugs = allOtSlugs.filter((s) => !PHASE_1_SLUGS.includes(s));
  const phase3Slugs = BOOKS.filter((b) => PHASE_3_EXTRA_SLUGS.has(b.slug)).map((b) => b.slug);
  const allSlugsInOrder = BOOKS.map((b) => b.slug);

  console.log("Building phase 1 (Torah + Gospels/Acts)…");
  const phase1Days = buildPhaseDays(chapterQueue(PHASE_1_SLUGS), PHASE_1_RANGE, 1);
  console.log("Building phase 2 (rest of the OT)…");
  const phase2Days = buildPhaseDays(chapterQueue(phase2Slugs), PHASE_2_RANGE, 2);
  console.log("Building phase 3 (Epistles + Revelation)…");
  const phase3Days = buildPhaseDays(chapterQueue(phase3Slugs), PHASE_3_RANGE, 3);
  console.log("Building phase 4 (full speed re-read)…");
  const phase4Days = buildPhaseDays(chapterQueue(allSlugsInOrder), PHASE_4_RANGE, 4);

  const allDays = [...phase1Days, ...phase2Days, ...phase3Days, ...phase4Days];
  console.log(`Prepared ${allDays.length} days. Upserting…`);

  const BATCH = 100;
  for (let i = 0; i < allDays.length; i += BATCH) {
    const batch = allDays.slice(i, i + BATCH);
    const { error } = await supabaseAdmin.from("reading_plan").upsert(batch, { onConflict: "day_idx" });
    if (error) throw error;
    process.stdout.write(`\r  ${Math.min(i + BATCH, allDays.length)}/${allDays.length}`);
  }

  const maxMinutes = Math.max(...allDays.map((d) => d.est_minutes));
  console.log(`\nDone. Max single-day reading estimate: ${maxMinutes} min (cap: ${HARD_CAP_MINUTES}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
