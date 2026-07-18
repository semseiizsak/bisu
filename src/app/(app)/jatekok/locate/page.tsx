import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LocateGame } from "@/components/games/LocateGame";

export default async function LocatePage() {
  const supabase = await createClient();
  const [{ data: cards }, { data: books }] = await Promise.all([
    supabase.from("cards").select("id, prompt, payload").eq("type", "locate").eq("active", true).limit(300),
    supabase.from("books").select("id, slug, short_hu, order_idx").order("order_idx"),
  ]);

  const shuffled = [...(cards ?? [])].sort(() => Math.random() - 0.5).slice(0, 10);
  const { data: states } = await supabase
    .from("card_states")
    .select("card_id, stability, difficulty, due_at, last_review, reps, lapses, state")
    .in("card_id", shuffled.map((c) => c.id));
  const stateByCard = new Map((states ?? []).map((s) => [s.card_id, s]));

  const items = shuffled.map((c) => ({
    id: c.id,
    prompt: c.prompt,
    payload: c.payload as { verse_text: string; book_id: number; chapter: number },
    state: stateByCard.get(c.id) ?? { stability: null, difficulty: null, due_at: null, last_review: null, reps: 0, lapses: 0, state: 0 },
  }));

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <Link href="/jatekok" className="text-sm font-extrabold text-ink-muted">
        ← Játékok
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Hol vagyok?</h1>
      <div className="mt-6">
        <LocateGame items={items} books={books ?? []} />
      </div>
    </main>
  );
}
