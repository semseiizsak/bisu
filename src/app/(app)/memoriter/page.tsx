import { createClient } from "@/lib/supabase/server";
import { MemoriterList, type MemoriterRow } from "@/components/verse/MemoriterList";

export default async function MemoriterPage() {
  const supabase = await createClient();

  const { data: verses } = await supabase
    .from("memory_verses")
    .select("card_id, reference, text, stage")
    .order("created_at", { ascending: false });

  const cardIds = (verses ?? []).map((v) => v.card_id);
  const [{ data: cards }, { data: states }] = cardIds.length
    ? await Promise.all([
        supabase.from("cards").select("id, active").in("id", cardIds),
        supabase.from("card_states").select("card_id, due_at").in("card_id", cardIds),
      ])
    : [{ data: [] }, { data: [] }];
  const activeCardIds = new Set((cards ?? []).filter((c) => c.active).map((c) => c.id));
  const dueByCard = new Map((states ?? []).map((s) => [s.card_id, s.due_at]));

  const now = Date.now();
  const rows: MemoriterRow[] = (verses ?? [])
    .filter((v) => activeCardIds.has(v.card_id))
    .map((v) => {
      const dueAt = dueByCard.get(v.card_id);
      return {
        card_id: v.card_id,
        reference: v.reference,
        text: v.text,
        stage: v.stage,
        due: dueAt ? new Date(dueAt).getTime() <= now : false,
      };
    });

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-6">
      <h1 className="text-2xl font-extrabold text-ink">Memoriter</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Olvasás közben jelölj ki egy szövegrészt, és válaszd a &bdquo;Megtanulom kívülről&rdquo; lehetőséget — a versek a napi
        ismétléssel együtt kerülnek elő.
      </p>

      <div className="mt-6">
        <MemoriterList verses={rows} />
      </div>
    </main>
  );
}
