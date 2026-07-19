import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BOOKS } from "@/lib/content/books";
import { loadReviewCards } from "@/lib/review/load-cards";
import { ReadingSessionCTA } from "@/components/reading/ReadingSessionCTA";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { dayIndexForDate } from "@/lib/session/day-index";
import type { McqPayload } from "@/lib/content/card-payloads";
import type { SessionMode } from "@/lib/session/types";

export default async function ChapterNotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ book: string; chapter: string }>;
  searchParams: Promise<{ next?: string; mode?: string; minutes?: string }>;
}) {
  const { book: bookSlug, chapter: chapterStr } = await params;
  const { next: nextParam, mode: modeParam, minutes: minutesParam } = await searchParams;
  const chapter = Number(chapterStr);
  if (!BOOKS.find((b) => b.slug === bookSlug) || !Number.isFinite(chapter)) notFound();

  const supabase = await createClient();
  const [{ data: book }, { data: settings }] = await Promise.all([
    supabase.from("books").select("id, name_hu").eq("slug", bookSlug).maybeSingle(),
    supabase.from("settings").select("program_start_date").eq("id", 1).maybeSingle(),
  ]);
  if (!book) notFound();

  const { data: candidates } = await supabase
    .from("cards")
    .select("id")
    .eq("book_id", book.id)
    .eq("chapter", chapter)
    .eq("active", true)
    .limit(10);

  const cards = await loadReviewCards(supabase, (candidates ?? []).map((c) => c.id));

  const showSessionCta = nextParam === "session";
  const sessionMode: SessionMode = modeParam === "short" ? "short" : "full";
  const dayIdx = dayIndexForDate(settings?.program_start_date ?? new Date().toISOString().slice(0, 10), new Date());
  const minutes = Math.max(1, Number(minutesParam) || 5);

  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-10">
      <Link href={`/olvasas/${bookSlug}/${chapter}`} className="text-sm font-extrabold text-ink-muted">
        ← Vissza az olvasáshoz
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Jegyzetek</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {book.name_hu} {chapter} — nézd át, mielőtt sorra kerül a kvíz.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {cards.map((c, i) => {
          const options = c.type === "mcq" ? (c.payload as McqPayload | null)?.options ?? [] : [];
          return (
            <Card key={c.id} className="p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">
                {i + 1}. {c.verse_ref ?? ""}
              </p>
              <p className="mt-1 text-ink">{c.prompt}</p>
              <p className="mt-2 text-lg font-extrabold text-accent">{c.answer}</p>
              {options.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {options.map((opt) => (
                    <span
                      key={opt}
                      className={
                        opt === c.answer
                          ? "rounded-full bg-good/70 px-2.5 py-1 text-xs font-extrabold text-paper"
                          : "rounded-full bg-line px-2.5 py-1 text-xs text-ink-faint"
                      }
                    >
                      {opt}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
        {cards.length === 0 && <p className="text-ink-muted">Nincs még kártya ehhez a fejezethez.</p>}
      </div>

      {cards.length > 0 && (
        <div className="mt-8">
          {showSessionCta ? (
            <ReadingSessionCTA dayIdx={dayIdx} minutes={minutes} mode={sessionMode} />
          ) : (
            <ButtonLink size="lg" href={`/olvasas/${bookSlug}/${chapter}/session`}>
              Készen állok — Kvíz indítása
            </ButtonLink>
          )}
        </div>
      )}
    </main>
  );
}
