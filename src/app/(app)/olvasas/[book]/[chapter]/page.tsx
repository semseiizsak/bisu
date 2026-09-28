import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BOOKS } from "@/lib/content/books";
import { ReaderClient } from "@/components/reading/ReaderClient";
import { ChapterNote } from "@/components/reading/ChapterNote";
import { FlowStepper } from "@/components/session/FlowStepper";
import { SermonRecs } from "@/components/sermons/SermonRecs";
import { ButtonLink } from "@/components/ui/Button";
import { currentDayIndex } from "@/lib/session/current-day";
import { getDaySpan, spanPosition } from "@/lib/session/day-span";

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ book: string; chapter: string }>;
  searchParams: Promise<{ flow?: string; mode?: string }>;
}) {
  const { book: bookSlug, chapter: chapterStr } = await params;
  const { flow, mode: modeParam } = await searchParams;
  const chapter = Number(chapterStr);
  const bookDef = BOOKS.find((b) => b.slug === bookSlug);
  if (!bookDef || !Number.isFinite(chapter)) notFound();

  const sessionMode = modeParam === "short" ? "short" : "full";

  const supabase = await createClient();
  const [{ data: book }, { data: allBooks }] = await Promise.all([
    supabase.from("books").select("id, name_hu, short_hu, chapters_count").eq("slug", bookSlug).maybeSingle(),
    supabase.from("books").select("slug, chapters_count"),
  ]);
  if (!book) notFound();

  const [{ data: verses }, { data: note }, { count: questionCount }] = await Promise.all([
    supabase.from("verses").select("verse, text").eq("book_id", book.id).eq("chapter", chapter).order("verse"),
    supabase.from("chapter_notes").select("*").eq("book_id", book.id).eq("chapter", chapter).maybeSingle(),
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("book_id", book.id)
      .eq("chapter", chapter)
      .in("type", ["question", "recall"])
      .eq("active", true),
  ]);

  if (!verses || verses.length === 0) notFound();

  // Daily guided flow: keep the flow params alive across chapter navigation.
  let inDailyFlow = false;
  let spanPos = -1;
  let spanLength = 0;
  let focusNote: string | null = null;
  let spanPrev: { book_slug: string; chapter: number } | null = null;
  if (flow === "daily") {
    const dayIdx = await currentDayIndex(supabase);
    const span = await getDaySpan(supabase, dayIdx);
    spanPos = spanPosition(span, bookSlug, chapter);
    inDailyFlow = spanPos >= 0;
    spanLength = span.chapters.length;
    focusNote = span.focusNote;
    spanPrev = inDailyFlow && spanPos > 0 ? span.chapters[spanPos - 1] : null;
  }
  const flowQuery = `?flow=daily&mode=${sessionMode}`;

  const chaptersCountBySlug = new Map((allBooks ?? []).map((b) => [b.slug, b.chapters_count]));
  const bookIdxInOrder = BOOKS.findIndex((b) => b.slug === bookSlug);

  const next =
    chapter < book.chapters_count
      ? { book: bookSlug, chapter: chapter + 1 }
      : BOOKS[bookIdxInOrder + 1]
        ? { book: BOOKS[bookIdxInOrder + 1].slug, chapter: 1 }
        : null;

  const prevBookSlug = BOOKS[bookIdxInOrder - 1]?.slug;
  const prev =
    chapter > 1
      ? { book: bookSlug, chapter: chapter - 1 }
      : prevBookSlug
        ? { book: prevBookSlug, chapter: chaptersCountBySlug.get(prevBookSlug) ?? 1 }
        : null;

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      {inDailyFlow ? (
        <FlowStepper stage={1} detail={`${book.name_hu} ${chapter} · fejezet ${spanPos + 1}/${spanLength}`} />
      ) : (
        <div className="flex items-center justify-between">
          <Link href="/olvasas" className="text-sm font-extrabold text-ink-muted">
            ← Olvasás
          </Link>
          <p className="text-sm font-extrabold text-ink">
            {book.name_hu} {chapter}
          </p>
          <span />
        </div>
      )}

      {inDailyFlow && focusNote && spanPos === 0 && (
        <p className="mt-3 rounded-md border border-line-strong bg-paper px-3 py-2 text-sm text-ink-muted">{focusNote}</p>
      )}

      <div className="mt-6">
        <ReaderClient verses={verses} bookId={book.id} bookShort={book.short_hu} chapter={chapter} />
      </div>

      {/* The study note sits after the text on purpose: read first, then get
          the summary and the connections — no spoilers, no crutch. */}
      {note && (
        <div className="mt-8">
          <ChapterNote note={note} compact />
        </div>
      )}

      <Suspense fallback={null}>
        <SermonRecs bookId={book.id} chapter={chapter} bookNameHu={book.name_hu} focusNote={focusNote} />
      </Suspense>

      <div className="mt-8 flex flex-col gap-3 pb-6">
        {inDailyFlow ? (
          <>
            <ButtonLink size="lg" href={`/olvasas/${bookSlug}/${chapter}/notes${flowQuery}`}>
              Elolvastam → jegyzet és kérdések
            </ButtonLink>
            {spanPrev && (
              <div className="flex justify-start">
                <ButtonLink variant="ghost" size="sm" href={`/olvasas/${spanPrev.book_slug}/${spanPrev.chapter}${flowQuery}`}>
                  ← Előző fejezet
                </ButtonLink>
              </div>
            )}
          </>
        ) : (
          <>
            <ButtonLink href={`/olvasas/${bookSlug}/${chapter}/notes`} variant="secondary">
              {(questionCount ?? 0) > 0 ? `Jegyzet és kérdések (${questionCount})` : "Jegyzet és kérdések készítése"}
            </ButtonLink>
            <div className="flex justify-between">
              {prev ? (
                <ButtonLink variant="ghost" size="sm" href={`/olvasas/${prev.book}/${prev.chapter}`}>
                  ← Előző fejezet
                </ButtonLink>
              ) : (
                <span />
              )}
              {next && (
                <ButtonLink variant="ghost" size="sm" href={`/olvasas/${next.book}/${next.chapter}`}>
                  Következő fejezet →
                </ButtonLink>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
