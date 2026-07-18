import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TimelineGame } from "@/components/games/TimelineGame";
import type { PersistedCardState } from "@/lib/fsrs/engine";

export default async function TimelinePage() {
  const supabase = await createClient();
  const { data: cards } = await supabase.from("cards").select("id, prompt, answer, payload").eq("type", "order").eq("active", true).limit(50);
  const pick = (cards ?? [])[Math.floor(Math.random() * Math.max(1, (cards ?? []).length))];

  let state: PersistedCardState = { stability: null, difficulty: null, due_at: null, last_review: null, reps: 0, lapses: 0, state: 0 };
  if (pick) {
    const { data: s } = await supabase
      .from("card_states")
      .select("stability, difficulty, due_at, last_review, reps, lapses, state")
      .eq("card_id", pick.id)
      .maybeSingle();
    if (s) state = s;
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <Link href="/jatekok" className="text-sm font-extrabold text-ink-muted">
        ← Játékok
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Idővonal</h1>
      {pick ? (
        <TimelineGame
          cardId={pick.id}
          prompt={pick.prompt}
          payload={pick.payload as { items: { id: number; label: string }[]; correct_order: number[] }}
          state={state}
        />
      ) : (
        <p className="mt-6 text-ink-muted">Nincs elég esemény generálva még.</p>
      )}
    </main>
  );
}
