import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NumbersGame } from "@/components/games/NumbersGame";
import { loadGameQuestions } from "@/lib/games/question-pool";

/** The memorable numbers only (40 days, 12 tribes, 3 days…) — one per
 * chapter at most by construction of the question pipeline. */
export default async function NumbersPage() {
  const supabase = await createClient();
  const questions = await loadGameQuestions(supabase, { kind: "number", count: 40 });
  const items = questions
    .filter((q) => /^\d+$/.test(q.answer.trim()))
    .map((q) => ({ id: q.id, prompt: q.prompt, answer: q.answer.trim(), unit: null, state: q.state }));

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <Link href="/jatekok" className="text-sm font-extrabold text-ink-muted">
        ← Játékok
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Számháború</h1>
      {items.length >= 5 ? <NumbersGame items={items} /> : <p className="mt-6 text-ink-muted">Nincs még elég szám-kérdés — olvass tovább.</p>}
    </main>
  );
}
