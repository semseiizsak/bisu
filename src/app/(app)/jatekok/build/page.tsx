import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BuildGame } from "@/components/games/BuildGame";

export default async function BuildPage() {
  const supabase = await createClient();
  const { data: objects } = await supabase.from("entities").select("id, name_hu").eq("type", "object");
  const pick = (objects ?? [])[Math.floor(Math.random() * Math.max(1, (objects ?? []).length))];

  if (!pick) {
    return (
      <main className="mx-auto max-w-md px-4 pt-6">
        <Link href="/jatekok" className="text-sm font-extrabold text-ink-muted">
          ← Játékok
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold text-ink">Építsd fel</h1>
        <p className="mt-6 text-ink-muted">Nincs még tárgy-adat (pl. Bárka, Szent sátor) a rendszerben.</p>
      </main>
    );
  }

  const { data: facts } = await supabase
    .from("facts")
    .select("id, fact_key, fact_value, numeric_val, unit, verified")
    .eq("entity_id", pick.id)
    .eq("verified", true)
    .eq("suppressed", false)
    .not("numeric_val", "is", null);

  const { data: cards } = await supabase
    .from("cards")
    .select("id, fact_id")
    .eq("entity_id", pick.id)
    .eq("type", "numeric")
    .eq("active", true);
  const cardByFact = new Map((cards ?? []).map((c) => [c.fact_id, c.id]));
  const cardIds = [...cardByFact.values()];
  const { data: states } = cardIds.length
    ? await supabase
        .from("card_states")
        .select("card_id, stability, difficulty, due_at, last_review, reps, lapses, state")
        .in("card_id", cardIds)
    : { data: [] };
  const stateByCard = new Map((states ?? []).map((s) => [s.card_id, s]));

  const fields = (facts ?? []).map((f) => {
    const cardId = cardByFact.get(f.id) ?? null;
    return {
      label: f.fact_key.replace(/_/g, " "),
      answer: f.numeric_val as number,
      unit: f.unit,
      cardId,
      state: cardId ? stateByCard.get(cardId) ?? null : null,
    };
  });

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <Link href="/jatekok" className="text-sm font-extrabold text-ink-muted">
        ← Játékok
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Építsd fel</h1>
      <p className="mt-1 text-ink-muted">{pick.name_hu} — töltsd ki a méreteket</p>
      <BuildGame fields={fields} />
    </main>
  );
}
