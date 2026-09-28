import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BOOKS } from "@/lib/content/books";
import { loadReviewCards } from "@/lib/review/load-cards";
import { currentDayIndex } from "@/lib/session/current-day";
import { getDaySpan, spanPosition } from "@/lib/session/day-span";
import { estimateReadingMinutes } from "@/lib/session/time-estimates";
import { PIPELINE_KIND } from "@/lib/pipeline/run";
import { ChapterNote } from "@/components/reading/ChapterNote";
import { QuestionGate } from "@/components/reading/QuestionGate";
import { PipelineKick } from "@/components/reading/PipelineKick";
import { ReadingSessionCTA } from "@/components/reading/ReadingSessionCTA";
import { FlowStepper } from "@/components/session/FlowStepper";
import { ButtonLink } from "@/components/ui/Button";

/**
 * Stage 2 of the reading flow, per chapter: the study note, then every
 * generated question with a keep / skip toggle. Runs the generator on the
 * spot if this chapter has nothing yet.
 */
export default async function ChapterNotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ book: string; chapter: string }>;
  searchParams: Promise<{ flow?: string; mode?: string }>;
}) {
  const { book: bookSlug, chapter: chapterStr } = await params;
  const { flow, mode: modeParam } = await searchParams;
  const chapter = Number(chapterStr);
  if (!BOOKS.find((b) => b.slug === bookSlug) || !Number.isFinite(chapter)) notFound();
  const sessionMode = modeParam === "short" ? "short" : "full";

  const supabase = await createClient();
  const { data: book } = await supabase.from("books").select("id, name_hu").eq("slug", bookSlug).maybeSingle();
  if (!book) notFound();

  const [{ data: note }, { data: cardRows }, { data: run }] = await Promise.all([
    supabase.from("chapter_notes").select("*").eq("book_id", book.id).eq("chapter", chapter).maybeSingle(),
    supabase
      .from("cards")
      .select("id, active, type")
      .eq("book_id", book.id)
      .eq("chapter", chapter)
      .in("type", ["question", "recall"])
      .order("id"),
    supabase.from("extraction_runs").select("status").eq("book_slug", bookSlug).eq("chapter", chapter).eq("kind", PIPELINE_KIND).maybeSingle(),
  ]);

  // Show generated questions (kept or skipped, so a skip can be undone) and
  // the reader's own cards for this chapter.
  const visible = (cardRows ?? []).filter((c) => c.type === "question" || c.active);
  const cards = await loadReviewCards(supabase, visible.map((c) => c.id), { includeInactive: true });
  const skippedIds = visible.filter((c) => !c.active).map((c) => c.id);
  const needsPipeline = !run && !note && cards.length === 0;

  // Daily-flow navigation: next chapter of the day, or hand over to the quiz.
  let flowNav: React.ReactNode = null;
  if (flow === "daily") {
    const dayIdx = await currentDayIndex(supabase);
    const span = await getDaySpan(supabase, dayIdx);
    const pos = spanPosition(span, bookSlug, chapter);
    if (pos >= 0) {
      const next = span.chapters[pos + 1];
      if (next) {
        flowNav = (
          <ButtonLink size="lg" href={`/olvasas/${next.book_slug}/${next.chapter}?flow=daily&mode=${sessionMode}`}>
            Következő fejezet →
          </ButtonLink>
        );
      } else {
        let verseCount = 0;
        for (const c of span.chapters) {
          const b = c.book_slug === bookSlug ? book : (await supabase.from("books").select("id").eq("slug", c.book_slug).maybeSingle()).data;
          if (!b) continue;
          const { count } = await supabase.from("verses").select("id", { count: "exact", head: true }).eq("book_id", b.id).eq("chapter", c.chapter);
          verseCount += count ?? 0;
        }
        flowNav = <ReadingSessionCTA dayIdx={dayIdx} minutes={Math.max(1, Math.round(estimateReadingMinutes(verseCount)))} mode={sessionMode} />;
      }
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-10">
      {flow === "daily" ? (
        <FlowStepper stage={2} detail={`${book.name_hu} ${chapter}`} />
      ) : (
        <Link href={`/olvasas/${bookSlug}/${chapter}`} className="text-sm font-extrabold text-ink-muted">
          ← Vissza az olvasáshoz
        </Link>
      )}
      <h1 className="mt-2 text-2xl font-extrabold text-ink">
        {book.name_hu} {chapter}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">Jegyzet és a kérdések, amikből a kvíz készül.</p>

      {needsPipeline && (
        <div className="mt-6">
          <PipelineKick chapters={[{ book: bookSlug, chapter }]} />
        </div>
      )}

      {note && (
        <div className="mt-6">
          <ChapterNote note={note} />
        </div>
      )}

      {cards.length > 0 && (
        <div className="mt-8">
          <QuestionGate cards={cards} initiallySkipped={skippedIds} />
        </div>
      )}

      {!needsPipeline && cards.length === 0 && (
        <p className="mt-6 text-ink-muted">
          {run?.status === "error" ? "A kérdésgenerálás hibára futott ennél a fejezetnél." : "Ehhez a fejezethez nem született kvízkérdés."}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3">
        {flowNav}
        {flow !== "daily" && cards.some((c) => !skippedIds.includes(c.id)) && (
          <ButtonLink size="lg" variant="secondary" href={`/olvasas/${bookSlug}/${chapter}/session`}>
            Kvíz csak ebből a fejezetből
          </ButtonLink>
        )}
      </div>
    </main>
  );
}
