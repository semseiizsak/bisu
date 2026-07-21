import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { BOOKS } from "@/lib/content/books";
import { dayIndexForDate } from "@/lib/session/day-index";
import { extractChapterFacts, loadExtractedChapter } from "@/lib/pipeline/extract";
import { generateCards } from "@/lib/pipeline/generate";
import { polishPendingCards } from "@/lib/pipeline/polish";

type DB = SupabaseClient<Database>;

const LOOKAHEAD_DAYS = 4; // today .. today+3
const MAX_CHAPTERS_PER_RUN = 2;
const WALL_CLOCK_BUDGET_MS = 45_000; // self-cap under the route's 60s maxDuration
const MODEL = "gpt-4o-mini";

interface ChapterResult {
  book_slug: string;
  chapter: number;
  status: "done" | "error" | "skipped_time_budget";
  factCount?: number;
  error?: string;
}

export interface JitSummary {
  chaptersAttempted: ChapterResult[];
  cardsCreated: number;
  cardsPolished: number;
}

/**
 * Expands the reading plan's next few days into their uncovered chapters,
 * extracts up to MAX_CHAPTERS_PER_RUN of them (one OpenAI call each), loads
 * the results straight into facts/entities (no filesystem — extraction_runs
 * is the resumability layer), then re-runs the deterministic card generator
 * and the polish pass so new content is playable the same day it's added.
 * Every chapter attempt gets an extraction_runs row regardless of outcome,
 * so a failure doesn't get retried forever.
 */
export async function runJitPipeline(admin: DB, openaiApiKey: string, now: Date = new Date()): Promise<JitSummary> {
  const startedAt = Date.now();
  const summary: JitSummary = { chaptersAttempted: [], cardsCreated: 0, cardsPolished: 0 };

  const { data: settings } = await admin.from("settings").select("program_start_date").eq("id", 1).maybeSingle();
  const programStart = settings?.program_start_date ?? now.toISOString().slice(0, 10);
  const todayIdx = dayIndexForDate(programStart, now);

  const { data: planRows } = await admin
    .from("reading_plan")
    .select("day_idx, segments")
    .gte("day_idx", todayIdx)
    .lt("day_idx", todayIdx + LOOKAHEAD_DAYS)
    .order("day_idx");

  const seen = new Set<string>();
  const targets: { book_slug: string; chapter: number }[] = [];
  for (const plan of planRows ?? []) {
    for (const seg of plan.segments) {
      for (let ch = seg.ch_from; ch <= seg.ch_to; ch++) {
        const key = `${seg.book_slug}:${ch}`;
        if (seen.has(key)) continue;
        seen.add(key);
        targets.push({ book_slug: seg.book_slug, chapter: ch });
      }
    }
  }
  if (targets.length === 0) return summary;

  const { data: alreadyRun } = await admin
    .from("extraction_runs")
    .select("book_slug, chapter")
    .in("book_slug", Array.from(new Set(targets.map((t) => t.book_slug))));
  const doneKeys = new Set((alreadyRun ?? []).map((r) => `${r.book_slug}:${r.chapter}`));

  const uncovered = targets.filter((t) => !doneKeys.has(`${t.book_slug}:${t.chapter}`)).slice(0, MAX_CHAPTERS_PER_RUN);
  if (uncovered.length === 0) return summary;

  const { data: dbBooks } = await admin.from("books").select("id, slug");
  const bookIdBySlug = new Map((dbBooks ?? []).map((b) => [b.slug, b.id]));

  const openai = new OpenAI({ apiKey: openaiApiKey });

  async function recordRun(target: { book_slug: string; chapter: number }, status: "done" | "error", extra: { fact_count?: number; error?: string }) {
    await admin.from("extraction_runs").insert({
      book_slug: target.book_slug,
      chapter: target.chapter,
      status,
      fact_count: extra.fact_count ?? 0,
      error: extra.error ?? null,
      model: MODEL,
    });
  }

  for (const target of uncovered) {
    if (Date.now() - startedAt > WALL_CLOCK_BUDGET_MS) {
      summary.chaptersAttempted.push({ ...target, status: "skipped_time_budget" });
      continue;
    }

    const bookDef = BOOKS.find((b) => b.slug === target.book_slug);
    const bookId = bookIdBySlug.get(target.book_slug);
    if (!bookDef || !bookId) {
      await recordRun(target, "error", { error: "book not found" });
      summary.chaptersAttempted.push({ ...target, status: "error", error: "book not found" });
      continue;
    }

    const { data: verses } = await admin.from("verses").select("verse, text").eq("book_id", bookId).eq("chapter", target.chapter).order("verse");
    if (!verses?.length) {
      await recordRun(target, "error", { error: "no verses in DB" });
      summary.chaptersAttempted.push({ ...target, status: "error", error: "no verses in DB" });
      continue;
    }

    try {
      const raw = await extractChapterFacts(openai, bookDef.short_hu, bookDef.name_hu, target.chapter, verses);
      const { factCount, skipped } = await loadExtractedChapter(admin, bookId, target.chapter, raw);
      if (skipped) {
        await recordRun(target, "error", { error: skipped });
        summary.chaptersAttempted.push({ ...target, status: "error", error: skipped });
      } else {
        await recordRun(target, "done", { fact_count: factCount });
        summary.chaptersAttempted.push({ ...target, status: "done", factCount });
      }
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      await recordRun(target, "error", { error: message });
      summary.chaptersAttempted.push({ ...target, status: "error", error: message });
    }
  }

  if (summary.chaptersAttempted.some((c) => c.status === "done")) {
    const { cardsCreated } = await generateCards(admin);
    summary.cardsCreated = cardsCreated;
    if (cardsCreated > 0) {
      const { polished } = await polishPendingCards(admin, openaiApiKey);
      summary.cardsPolished = polished;
    }
  }

  return summary;
}
