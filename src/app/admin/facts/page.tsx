import { createClient } from "@/lib/supabase/server";
import { FactReviewList } from "@/components/admin/FactReviewList";

export default async function AdminFactsPage() {
  const supabase = await createClient();
  const { data: facts, error } = await supabase
    .from("facts")
    .select("id, fact_key, fact_value, verse_ref, confidence, verified, entity_id, book_id, chapter")
    .or("verified.eq.false,confidence.lt.0.9")
    .order("book_id")
    .order("chapter")
    .limit(500);

  const entityIds = Array.from(new Set((facts ?? []).map((f) => f.entity_id).filter(Boolean))) as number[];
  const { data: entities } = entityIds.length
    ? await supabase.from("entities").select("id, name_hu").in("id", entityIds)
    : { data: [] };
  const entityNameById = new Map((entities ?? []).map((e) => [e.id, e.name_hu]));

  const rows = (facts ?? []).map((f) => ({
    ...f,
    entity_name: f.entity_id ? entityNameById.get(f.entity_id) ?? "—" : "—",
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-ink">Tények ellenőrzése</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {rows.length} tény vár jóváhagyásra (ellenőrizetlen vagy confidence &lt; 0.9).
        <span className="ml-2">
          <kbd className="rounded border border-line-strong px-1 text-xs">j</kbd>/
          <kbd className="rounded border border-line-strong px-1 text-xs">k</kbd> mozgás ·{" "}
          <kbd className="rounded border border-line-strong px-1 text-xs">Enter</kbd> jóváhagy ·{" "}
          <kbd className="rounded border border-line-strong px-1 text-xs">e</kbd> szerkeszt
        </span>
      </p>

      {error && <p className="mt-4 text-bad">Hiba: {error.message}</p>}

      <FactReviewList facts={rows} />
    </main>
  );
}
