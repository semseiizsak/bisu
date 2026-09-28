import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type DB = SupabaseClient<Database>;

export interface SpanChapter {
  book_slug: string;
  chapter: number;
}

export interface DaySpan {
  dayIdx: number;
  chapters: SpanChapter[];
  focusNote: string | null;
}

/** The chapters a plan day covers, flattened in reading order. */
export async function getDaySpan(db: DB, dayIdx: number): Promise<DaySpan> {
  const { data: planRow } = await db.from("reading_plan").select("segments, focus_note").eq("day_idx", dayIdx).maybeSingle();
  const chapters: SpanChapter[] = [];
  for (const seg of planRow?.segments ?? []) {
    for (let ch = seg.ch_from; ch <= seg.ch_to; ch++) chapters.push({ book_slug: seg.book_slug, chapter: ch });
  }
  return { dayIdx, chapters, focusNote: planRow?.focus_note ?? null };
}

export function spanPosition(span: DaySpan, bookSlug: string, chapter: number): number {
  return span.chapters.findIndex((c) => c.book_slug === bookSlug && c.chapter === chapter);
}
