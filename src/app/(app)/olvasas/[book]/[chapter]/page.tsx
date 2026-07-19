import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BOOKS } from "@/lib/content/books";
import { ReaderClient } from "@/components/reading/ReaderClient";
import { FlowStepper } from "@/components/session/FlowStepper";
import { ButtonLink } from "@/components/ui/Button";
import { dayIndexForDate } from "@/lib/session/day-index";

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
  const [{ data: book }, { data: allBooks }, { data: settings }] = await Promise.all([
    supabase.from("books").select("id, name_hu, short_hu, chapters_count").eq("slug", bookSlug).maybeSingle(),
    supabase.from("books").select("slug, chapters_count"),
    supabase.from("settings").select("program_start_date").eq("id", 1).maybeSingle(),
  ]);
  if (!book) notFound();

  const [{ data: verses }, { count: cardCount }] = await Promise.all([
    supabase.from("verses").select("verse, text").eq("book_id", book.id).eq("chapter", chapter).order("verse"),
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("book_id", book.id)
      .eq("chapter", chapter)
      .eq("active", true),
  ]);

  if (!verses || verses.length === 0) notFound();

  const sessionCardCount = Math.min(10, cardCount ?? 0);

  // Daily guided flow: walk today's reading span chapter by chapter, keeping
  // the flow params alive across navigation (their loss on prev/next links
  // was the bug that killed the guided session after the first chapter).
  let daySpan: { book_slug: string; chapter: number }[] = [];
  if (flow === "daily") {
    const dayIdx = dayIndexForDate(settings?.program_start_date ?? new Date().toISOString().slice(0, 10), new Date());
    const { data: planRow } = await supabase.from("reading_plan").select("segments").eq("day_idx", dayIdx).maybeSingle();
    for (const seg of planRow?.segments ?? []) {
      for (let ch = seg.ch_from; ch <= seg.ch_to; ch++) daySpan.push({ book_slug: seg.book_slug, chapter: ch });
    }
  }
  const spanPos = daySpan.findIndex((c) => c.book_slug === bookSlug && c.chapter === chapter);
  const inDailyFlow = flow === "daily" && spanPos >= 0;
  if (flow === "daily" && spanPos < 0) daySpan = [];

  const flowQuery = `?flow=daily&mode=${sessionMode}`;
  const spanPrev = inDailyFlow && spanPos > 0 ? daySpan[spanPos - 1] : null;
  const spanNext = inDailyFlow && spanPos < daySpan.length - 1 ? daySpan[spanPos + 1] : null;
  const isLastOfSpan = inDailyFlow && spanPos === daySpan.length - 1;

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
        <FlowStepper stage={1} detail={`${book.name_hu} ${chapter} · fejezet ${spanPos + 1}/${daySpan.length}`} />
      ) : (
        <div className="flex items-center justify-between">
          <Link href="/olvasas" className="text-sm font-extrabold text-ink-muted">
            ← Ma
          </Link>
          <p className="text-sm font-extrabold text-ink">
            {book.name_hu} {chapter}
          </p>
          <span />
        </div>
      )}

      <div className="mt-6">
        <ReaderClient verses={verses} bookId={book.id} bookShort={book.short_hu} chapter={chapter} />
      </div>

      <div className="mt-8 flex flex-col gap-3 pb-6">
        {inDailyFlow ? (
          <>
            {isLastOfSpan ? (
              <ButtonLink size="lg" href={`/ma/session/notes?mode=${sessionMode}`}>
                Tovább a jegyzetekhez →
              </ButtonLink>
            ) : (
              spanNext && (
                <ButtonLink size="lg" href={`/olvasas/${spanNext.book_slug}/${spanNext.chapter}${flowQuery}`}>
                  Következő fejezet →
                </ButtonLink>
              )
            )}
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
            {sessionCardCount > 0 && (
              <ButtonLink href={`/olvasas/${bookSlug}/${chapter}/notes`}>
                Jegyzetek megtekintése ({sessionCardCount} kártya)
              </ButtonLink>
            )}
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
