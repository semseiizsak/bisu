import Link from "next/link";
import { BOOKS } from "@/lib/content/books";

export default function BooksPage() {
  const ot = BOOKS.filter((b) => b.testament === "OT");
  const nt = BOOKS.filter((b) => b.testament === "NT");

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-6">
      <div className="flex items-center justify-between">
        <Link href="/olvasas" className="text-sm font-extrabold text-ink-muted">
          ← Olvasás
        </Link>
      </div>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Válassz könyvet</h1>
      <p className="mt-1 text-sm text-ink-muted">Bármelyik könyv 1. fejezetétől kezdve szabadon olvashatsz, lapozva tovább.</p>

      {[
        { label: "Ószövetség", books: ot },
        { label: "Újszövetség", books: nt },
      ].map((group) => (
        <section key={group.label} className="mt-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">{group.label}</h2>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {group.books.map((b) => (
              <Link
                key={b.slug}
                href={`/olvasas/${b.slug}/1`}
                className="rounded-md border border-line bg-surface px-3 py-2.5 text-sm font-extrabold text-ink hover:border-ink/40"
              >
                {b.name_hu}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
