import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { QuizGame } from "@/components/games/QuizGame";

/**
 * "Ki mondta?" per the handoff is a quote -> speaker quiz. The content
 * pipeline doesn't extract speaker-attribution facts yet (would need a
 * dedicated fact_key like `mondta` during extraction), so this reuses the
 * general mcq card pool for now — same interaction shape, ready to swap in
 * dedicated quote cards once that fact type is extracted.
 */
export default async function WhoSaidPage() {
  const supabase = await createClient();
  const { data: cards } = await supabase.from("cards").select("id, prompt, answer, payload").eq("type", "mcq").eq("active", true).limit(200);
  const pool = [...(cards ?? [])].sort(() => Math.random() - 0.5).slice(0, 10);
  const { data: states } = await supabase
    .from("card_states")
    .select("card_id, stability, difficulty, due_at, last_review, reps, lapses, state")
    .in("card_id", pool.map((c) => c.id));
  const stateByCard = new Map((states ?? []).map((s) => [s.card_id, s]));

  const items = pool.map((c) => ({
    id: c.id,
    prompt: c.prompt,
    answer: c.answer,
    options: (c.payload as { options: string[] } | null)?.options ?? [],
    state: stateByCard.get(c.id) ?? { stability: null, difficulty: null, due_at: null, last_review: null, reps: 0, lapses: 0, state: 0 },
  }));

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <Link href="/jatekok" className="text-sm font-extrabold text-ink-muted">
        ← Játékok
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Ki mondta?</h1>
      <QuizGame items={items} mode="game:who-said" />
    </main>
  );
}
