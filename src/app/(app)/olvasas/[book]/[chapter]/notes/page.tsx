import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BOOKS } from "@/lib/content/books";
import { loadReviewCards } from "@/lib/review/load-cards";
import { NotesList } from "@/components/session/NotesList";
import { ButtonLink } from "@/components/ui/Button";

export default async function ChapterNotesPage({
  params,
}: {
  params: Promise<{ book: string; chapter: string }>;
}) {
  const { book: bookSlug, chapter: chapterStr } = await params;
  const chapter = Number(chapterStr);
  if (!BOOKS.find((b) => b.slug === bookSlug) || !Number.isFinite(chapter)) notFound();

  const supabase = await createClient();
  const { data: book } = await supabase.from("books").select("id, name_hu").eq("slug", bookSlug).maybeSingle();
  if (!book) notFound();

  const { data: candidates } = await supabase
    .from("cards")
    .select("id")
    .eq("book_id", book.id)
    .eq("chapter", chapter)
    .eq("active", true)
    .limit(10);

  const cards = await loadReviewCards(supabase, (candidates ?? []).map((c) => c.id));

  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-10">
      <Link href={`/olvasas/${bookSlug}/${chapter}`} className="text-sm font-extrabold text-ink-muted">
        ← Vissza az olvasáshoz
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Jegyzetek</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {book.name_hu} {chapter} — nézd át, mielőtt sorra kerül a kvíz.
      </p>

      <div className="mt-6">
        <NotesList cards={cards} />
        {cards.length === 0 && <p className="text-ink-muted">Nincs még kártya ehhez a fejezethez.</p>}
      </div>

      {cards.length > 0 && (
        <div className="mt-8">
          <ButtonLink size="lg" href={`/olvasas/${bookSlug}/${chapter}/session`}>
            Készen állok — Kvíz indítása
          </ButtonLink>
        </div>
      )}
    </main>
  );
}
