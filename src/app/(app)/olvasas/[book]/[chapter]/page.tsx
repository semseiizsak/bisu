import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BOOKS } from "@/lib/content/books";
import { ReaderClient } from "@/components/reading/ReaderClient";
import { ButtonLink } from "@/components/ui/Button";

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ book: string; chapter: string }>;
}) {
  const { book: bookSlug, chapter: chapterStr } = await params;
  const chapter = Number(chapterStr);
  const bookDef = BOOKS.find((b) => b.slug === bookSlug);
  if (!bookDef || !Number.isFinite(chapter)) notFound();

  const supabase = await createClient();
  const [{ data: book }, { data: allBooks }] = await Promise.all([
    supabase.from("books").select("id, name_hu, short_hu, chapters_count").eq("slug", bookSlug).maybeSingle(),
    supabase.from("books").select("slug, chapters_count"),
  ]);
  if (!book) notFound();

  const { data: verses } = await supabase
    .from("verses")
    .select("verse, text")
    .eq("book_id", book.id)
    .eq("chapter", chapter)
    .order("verse");

  if (!verses || verses.length === 0) notFound();

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
        <ButtonLink href={`/olvasas/${bookSlug}/${chapter}/session`} variant="secondary">
          10 friss kártya erről a szakaszról
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
      </div>
    </main>
  );
}
