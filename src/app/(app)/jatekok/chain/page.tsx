import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChainGame } from "@/components/games/ChainGame";

export default async function ChainPage() {
  const supabase = await createClient();
  const { data: edges } = await supabase.from("genealogy_edges").select("parent_id, child_id, line");
  const { data: entities } = await supabase.from("entities").select("id, name_hu");
  const nameById = new Map((entities ?? []).map((e) => [e.id, e.name_hu]));

  const byLine = new Map<string, { parent_id: number; child_id: number }[]>();
  for (const e of edges ?? []) {
    if (!e.line || e.parent_id == null || e.child_id == null) continue;
    if (!byLine.has(e.line)) byLine.set(e.line, []);
    byLine.get(e.line)!.push({ parent_id: e.parent_id, child_id: e.child_id });
  }

  const eligibleLines = [...byLine.entries()].filter(([, es]) => es.length >= 3);
  const [line, lineEdges] = eligibleLines[Math.floor(Math.random() * Math.max(1, eligibleLines.length))] ?? [null, []];

  let chainIds: number[] = [];
  if (line) {
    const childSet = new Set(lineEdges.map((e) => e.child_id));
    const parentToChild = new Map(lineEdges.map((e) => [e.parent_id, e.child_id]));
    const root = lineEdges.find((e) => !childSet.has(e.parent_id))?.parent_id ?? lineEdges[0].parent_id;
    const forward: number[] = [root];
    let current = root;
    while (parentToChild.has(current)) {
      current = parentToChild.get(current)!;
      forward.push(current);
    }
    chainIds = forward.reverse(); // leaf -> root
  }

  const { data: chainCards } = chainIds.length
    ? await supabase.from("cards").select("id, entity_id").eq("type", "chain").eq("active", true).in("entity_id", chainIds)
    : { data: [] };
  const cardIds = (chainCards ?? []).map((c) => c.id);
  const { data: states } = cardIds.length
    ? await supabase
        .from("card_states")
        .select("card_id, stability, difficulty, due_at, last_review, reps, lapses, state")
        .in("card_id", cardIds)
    : { data: [] };
  const stateByCard = new Map((states ?? []).map((s) => [s.card_id, s]));
  const cardByEntity = new Map((chainCards ?? []).map((c) => [c.entity_id, c.id]));

  const steps = chainIds.slice(0, -1).map((childId, i) => {
    const parentId = chainIds[i + 1];
    const cardId = cardByEntity.get(childId) ?? null;
    return {
      childName: nameById.get(childId) ?? "?",
      parentName: nameById.get(parentId) ?? "?",
      cardId,
      state: cardId ? stateByCard.get(cardId) ?? null : null,
    };
  });

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <Link href="/jatekok" className="text-sm font-extrabold text-ink-muted">
        ← Játékok
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-ink">Genealógia-lánc</h1>
      {steps.length >= 2 ? (
        <ChainGame steps={steps} line={line ?? ""} />
      ) : (
        <p className="mt-6 text-ink-muted">Nincs elég genealógiai adat még.</p>
      )}
    </main>
  );
}
