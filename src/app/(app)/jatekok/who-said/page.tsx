import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { QuizGame } from "@/components/games/QuizGame";
import { loadGameQuestions } from "@/lib/games/question-pool";

/** Sayings quiz: who said what, what was promised, what was commanded —
 * the `saying` question kind, topped up from the rest of the deck. */
export default async function WhoSaidPage() {
  const supabase = await createClient();
  let items = await loadGameQuestions(supabase, { kind: "saying", count: 10 });
  if (items.length < 10) {
    const seen = new Set(items.map((i) => i.id));
    const extra = await loadGameQuestions(supabase, { count: 10 - items.length + 5 });
    items = [...items, ...extra.filter((e) => !seen.has(e.id))].slice(0, 10);
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <Link href="/jatekok" className="text-sm font-extrabold text-ink-muted">
        ← Játékok
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Ki mondta?</h1>
      {items.length ? <QuizGame items={items} mode="game:who-said" /> : <p className="mt-6 text-ink-muted">Nincs még elég kérdés — olvass pár fejezetet.</p>}
    </main>
  );
}
