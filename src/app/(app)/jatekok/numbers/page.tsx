import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NumbersGame } from "@/components/games/NumbersGame";

export default async function NumbersPage() {
  const supabase = await createClient();
  const { data: cards } = await supabase
    .from("cards")
    .select("id, prompt, answer, payload")
    .eq("type", "numeric")
    .eq("active", true)
    .limit(200);

  const pool = [...(cards ?? [])].sort(() => Math.random() - 0.5).slice(0, 40);
  const { data: states } = await supabase
    .from("card_states")
    .select("card_id, stability, difficulty, due_at, last_review, reps, lapses, state")
    .in("card_id", pool.map((c) => c.id));
  const stateByCard = new Map((states ?? []).map((s) => [s.card_id, s]));

  const items = pool.map((c) => ({
    id: c.id,
    prompt: c.prompt,
    answer: c.answer,
    unit: (c.payload as { unit: string | null } | null)?.unit ?? null,
    state: stateByCard.get(c.id) ?? { stability: null, difficulty: null, due_at: null, last_review: null, reps: 0, lapses: 0, state: 0 },
  }));

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <Link href="/jatekok" className="text-sm font-extrabold text-ink-muted">
        ← Játékok
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Számháború</h1>
      <NumbersGame items={items} />
    </main>
  );
}
