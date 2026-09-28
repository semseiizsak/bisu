import OpenAI from "openai";
import pLimit from "p-limit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { currentDayIndex } from "@/lib/session/current-day";
import { generateChapterContent, loadChapterContent, questionModel } from "@/lib/pipeline/questions";

type DB = SupabaseClient<Database>;

export const PIPELINE_KIND = "questions";
const LOOKAHEAD_DAYS = 4; // today .. today+3 in the plan
const MAX_CHAPTERS_PER_RUN = 10;
const CONCURRENCY = 3;
const WALL_CLOCK_BUDGET_MS = 45_000; // under the route's 60s maxDuration

export interface ChapterTarget {
  book_slug: string;
  chapter: number;
}

export interface ChapterResult extends ChapterTarget {
  status: "done" | "error" | "skipped_time_budget" | "already_done";
  cardsCreated?: number;
  rejected?: number;
  error?: string;
}

export interface PipelineSummary {
  chapters: ChapterResult[];
  cardsCreated: number;
}

/** Chapters in the reading plan window that have no question run yet. */
export async function upcomingUncoveredChapters(admin: DB, lookaheadDays: number = LOOKAHEAD_DAYS): Promise<ChapterTarget[]> {
  const todayIdx = await currentDayIndex(admin);
  const { data: planRows } = await admin
    .from("reading_plan")
    .select("day_idx, segments")
    .gte("day_idx", todayIdx)
    .lt("day_idx", todayIdx + lookaheadDays)
    .order("day_idx");

  const seen = new Set<string>();
  const targets: ChapterTarget[] = [];
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
  return filterUncovered(admin, targets);
}

export async function filterUncovered(admin: DB, targets: ChapterTarget[]): Promise<ChapterTarget[]> {
  if (targets.length === 0) return [];
  const { data: alreadyRun } = await admin
    .from("extraction_runs")
    .select("book_slug, chapter")
    .eq("kind", PIPELINE_KIND)
    .in("book_slug", Array.from(new Set(targets.map((t) => t.book_slug))));
  const done = new Set((alreadyRun ?? []).map((r) => `${r.book_slug}:${r.chapter}`));
  return targets.filter((t) => !done.has(`${t.book_slug}:${t.chapter}`));
}

/**
 * Generates study notes + questions for the given chapters. Every attempt
 * gets an extraction_runs row (kind = 'questions') so a failure isn't
 * retried forever; delete the row (or pass force) to regenerate.
 */
export async function generateForChapters(
  admin: DB,
  openai: OpenAI,
  targets: ChapterTarget[],
  opts: { wallClockMs?: number; concurrency?: number; force?: boolean; onChapter?: (r: ChapterResult) => void } = {},
): Promise<PipelineSummary> {
  const startedAt = Date.now();
  const wallClock = opts.wallClockMs ?? WALL_CLOCK_BUDGET_MS;
  const limit = pLimit(opts.concurrency ?? CONCURRENCY);
  const model = questionModel();
  const summary: PipelineSummary = { chapters: [], cardsCreated: 0 };

  const { data: dbBooks } = await admin.from("books").select("id, slug, short_hu, name_hu, order_idx");
  const bookBySlug = new Map((dbBooks ?? []).map((b) => [b.slug, b]));

  const pending = opts.force ? targets : await filterUncovered(admin, targets);
  for (const t of targets) {
    if (!pending.includes(t)) summary.chapters.push({ ...t, status: "already_done" });
  }

  async function recordRun(target: ChapterTarget, status: "done" | "error", extra: { fact_count?: number; error?: string }) {
    await admin.from("extraction_runs").upsert(
      {
        book_slug: target.book_slug,
        chapter: target.chapter,
        kind: PIPELINE_KIND,
        status,
        fact_count: extra.fact_count ?? 0,
        error: extra.error ?? null,
        model,
        created_at: new Date().toISOString(),
      },
      { onConflict: "book_slug,chapter,kind" },
    );
  }

  await Promise.all(
    pending.map((target) =>
      limit(async () => {
        const push = (r: ChapterResult) => {
          summary.chapters.push(r);
          opts.onChapter?.(r);
        };
        if (Date.now() - startedAt > wallClock) {
          push({ ...target, status: "skipped_time_budget" });
          return;
        }
        const book = bookBySlug.get(target.book_slug);
        if (!book) {
          await recordRun(target, "error", { error: "book not found" });
          push({ ...target, status: "error", error: "book not found" });
          return;
        }
        const { data: verses } = await admin.from("verses").select("verse, text").eq("book_id", book.id).eq("chapter", target.chapter).order("verse");
        if (!verses?.length) {
          await recordRun(target, "error", { error: "no verses in DB" });
          push({ ...target, status: "error", error: "no verses in DB" });
          return;
        }
        try {
          const raw = await generateChapterContent(openai, book.name_hu, book.short_hu, target.chapter, verses, model);
          const loaded = await loadChapterContent(admin, book, target.chapter, raw, model);
          await recordRun(target, "done", { fact_count: loaded.cardsCreated });
          summary.cardsCreated += loaded.cardsCreated;
          push({ ...target, status: "done", cardsCreated: loaded.cardsCreated, rejected: loaded.report.rejected.length });
        } catch (err) {
          const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
          await recordRun(target, "error", { error: message });
          push({ ...target, status: "error", error: message });
        }
      }),
    ),
  );

  return summary;
}

/**
 * Cron / on-demand entry point: covers the next few days of the reading
 * plan, or the explicitly requested chapters (from the reader, when someone
 * opens a chapter whose questions don't exist yet).
 */
export async function runJitPipeline(admin: DB, openaiApiKey: string, explicit?: ChapterTarget[]): Promise<PipelineSummary> {
  const openai = new OpenAI({ apiKey: openaiApiKey });
  const targets = explicit?.length ? explicit : await upcomingUncoveredChapters(admin);
  if (targets.length === 0) return { chapters: [], cardsCreated: 0 };
  return generateForChapters(admin, openai, targets.slice(0, MAX_CHAPTERS_PER_RUN));
}
