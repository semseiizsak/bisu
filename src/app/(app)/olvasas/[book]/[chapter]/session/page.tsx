import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BOOKS } from "@/lib/content/books";
import { loadReviewCards } from "@/lib/review/load-cards";
import { SessionRunner } from "@/components/review/SessionRunner";

export default async function ChapterSessionPage({
  params,
}: {
  params: Promise<{ book: string; chapter: string }>;
}) {
  const { book: bookSlug, chapter: chapterStr } = await params;
  const chapter = Number(chapterStr);
  if (!BOOKS.find((b) => b.slug === bookSlug) || !Number.isFinite(chapter)) notFound();

  const supabase = await createClient();
  const { data: book } = await supabase.from("books").select("id").eq("slug", bookSlug).maybeSingle();
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
    <main className="mx-auto max-w-md px-4 pt-6">
      <Link href={`/olvasas/${bookSlug}/${chapter}`} className="text-sm font-extrabold text-ink-muted">
        ← Vissza az olvasáshoz
      </Link>
      <div className="mt-4">
        <SessionRunner cards={cards} />
      </div>
    </main>
  );
}
