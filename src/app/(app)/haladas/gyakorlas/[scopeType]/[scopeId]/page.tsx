import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadReviewCards } from "@/lib/review/load-cards";
import { SessionRunner } from "@/components/review/SessionRunner";

export default async function PracticeScopePage({
  params,
}: {
  params: Promise<{ scopeType: string; scopeId: string }>;
}) {
  const { scopeType, scopeId: rawScopeId } = await params;
  const scopeId = decodeURIComponent(rawScopeId);
  const supabase = await createClient();

  let query = supabase.from("cards").select("id").eq("active", true).limit(20);
  if (scopeType === "book") {
    const { data: book } = await supabase.from("books").select("id").eq("slug", scopeId).maybeSingle();
    query = query.eq("book_id", book?.id ?? -1);
  } else if (scopeType === "entity") {
    query = query.eq("entity_id", Number(scopeId.split(":")[1]));
  } else if (scopeType === "era") {
    query = query.eq("type", "order").contains("tags", [scopeId]);
  }

  const { data: candidates } = await query;
  const cards = await loadReviewCards(supabase, (candidates ?? []).map((c) => c.id));

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <Link href="/haladas" className="text-sm font-extrabold text-ink-muted">
        ← Haladás
      </Link>
      <div className="mt-4">
        <SessionRunner cards={cards} />
      </div>
    </main>
  );
}
