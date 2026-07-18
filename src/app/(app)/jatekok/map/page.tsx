import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MapGame } from "@/components/games/MapGame";

export default async function MapPage() {
  const supabase = await createClient();
  const { data: places } = await supabase.from("geo_places").select("id, entity_id, svg_x, svg_y, tolerance, place_type");
  const { data: entities } = await supabase.from("entities").select("id, name_hu");
  const nameById = new Map((entities ?? []).map((e) => [e.id, e.name_hu]));

  const { data: cards } = await supabase.from("cards").select("id, entity_id").eq("type", "map").eq("active", true);
  const cardByEntity = new Map((cards ?? []).map((c) => [c.entity_id, c.id]));
  const cardIds = [...cardByEntity.values()];
  const { data: states } = cardIds.length
    ? await supabase
        .from("card_states")
        .select("card_id, stability, difficulty, due_at, last_review, reps, lapses, state")
        .in("card_id", cardIds)
    : { data: [] };
  const stateByCard = new Map((states ?? []).map((s) => [s.card_id, s]));

  const items = (places ?? [])
    .filter((p): p is typeof p & { entity_id: number } => p.entity_id != null)
    .map((p) => {
      const cardId = cardByEntity.get(p.entity_id) ?? null;
      return {
        name: nameById.get(p.entity_id) ?? "?",
        svg_x: p.svg_x,
        svg_y: p.svg_y,
        tolerance: p.tolerance,
        cardId,
        state: cardId ? stateByCard.get(cardId) ?? null : null,
      };
    });

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <Link href="/jatekok" className="text-sm font-extrabold text-ink-muted">
        ← Játékok
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Térkép</h1>
      {items.length ? <MapGame items={items} /> : <p className="mt-6 text-ink-muted">Nincs még helyszín-adat.</p>}
    </main>
  );
}
