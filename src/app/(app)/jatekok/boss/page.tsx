import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BossFightGame } from "@/components/games/BossFightGame";

export default async function BossPage() {
  const supabase = await createClient();
  const { data: books } = await supabase.from("books").select("id, slug, name_hu, order_idx").order("order_idx");
  const { data: cardCounts } = await supabase.from("cards").select("book_id").eq("type", "mcq").eq("active", true);
  const countByBook = new Map<number, number>();
  for (const c of cardCounts ?? []) {
    if (c.book_id == null) continue;
    countByBook.set(c.book_id, (countByBook.get(c.book_id) ?? 0) + 1);
  }
  const eligible = (books ?? [])
    .filter((b) => (countByBook.get(b.id) ?? 0) >= 10)
    .map((b) => ({ id: b.id, slug: b.slug, name: b.name_hu, count: countByBook.get(b.id) ?? 0 }));

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <Link href="/jatekok" className="text-sm font-extrabold text-ink-muted">
        ← Játékok
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Boss fight</h1>
      <p className="mt-1 text-ink-muted">40 kérdés, 20 másodperc / kérdés. 85% felett bónusz jár.</p>
      {eligible.length ? (
        <BossFightGame books={eligible} />
      ) : (
        <p className="mt-6 text-ink-muted">Egyik könyvnek sincs még legalább 10 MCQ kártyája.</p>
      )}
    </main>
  );
}
