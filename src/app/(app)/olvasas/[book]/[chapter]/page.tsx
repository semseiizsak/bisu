import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BOOKS } from "@/lib/content/books";
import { ReaderClient } from "@/components/reading/ReaderClient";
import { ReadingSessionCTA } from "@/components/reading/ReadingSessionCTA";
import { ButtonLink } from "@/components/ui/Button";
import { dayIndexForDate } from "@/lib/session/day-index";
import { estimateReadingMinutes } from "@/lib/session/time-estimates";

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ book: string; chapter: string }>;
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const { book: bookSlug, chapter: chapterStr } = await params;
  const { next: nextParam, mode: modeParam } = await searchParams;
  const chapter = Number(chapterStr);
  const bookDef = BOOKS.find((b) => b.slug === bookSlug);
  if (!bookDef || !Number.isFinite(chapter)) notFound();

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
  const showSessionCta = nextParam === "session";
  const sessionMode = modeParam === "short" ? "short" : "full";
  const dayIdx = dayIndexForDate(settings?.program_start_date ?? new Date().toISOString().slice(0, 10), new Date());
  const readingMinutes = Math.max(1, Math.round(estimateReadingMinutes(verses.length)));

  const notesParams = new URLSearchParams();
  if (showSessionCta) {
    notesParams.set("next", "session");
    notesParams.set("mode", sessionMode);
    notesParams.set("minutes", String(readingMinutes));
  }
  const notesHref = `/olvasas/${bookSlug}/${chapter}/notes${notesParams.size ? `?${notesParams}` : ""}`;

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
      <div className="flex items-center justify-between">
        <Link href="/olvasas" className="text-sm font-extrabold text-ink-muted">
          ← Ma
        </Link>
        <p className="text-sm font-extrabold text-ink">
          {book.name_hu} {chapter}
        </p>
        <span />
      </div>

      <div className="mt-6">
        <ReaderClient verses={verses} bookId={book.id} bookShort={book.short_hu} chapter={chapter} />
      </div>

      <div className="mt-8 flex flex-col gap-3 pb-6">
        {sessionCardCount > 0 ? (
          <ButtonLink href={notesHref}>Jegyzetek megtekintése ({sessionCardCount} kártya)</ButtonLink>
        ) : (
          showSessionCta && <ReadingSessionCTA dayIdx={dayIdx} minutes={readingMinutes} mode={sessionMode} />
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
      </div>
    </main>
  );
}
