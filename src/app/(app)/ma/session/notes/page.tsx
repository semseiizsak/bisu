import { createClient } from "@/lib/supabase/server";
import { buildSessionPlan } from "@/lib/session/build-session";
import { loadReviewCards } from "@/lib/review/load-cards";
import { FlowStepper } from "@/components/session/FlowStepper";
import { NotesList } from "@/components/session/NotesList";
import { ReadingSessionCTA } from "@/components/reading/ReadingSessionCTA";
import { ButtonLink } from "@/components/ui/Button";
import type { SessionMode } from "@/lib/session/types";

const NOTES_PER_GROUP = 30;

/** Stage 2 of the guided daily session: one aggregated study sheet covering
 * everything the upcoming quiz can draw from today — the cards of the whole
 * day's reading span plus the session's brand-new (state-0) cards — so new
 * material is revised before it is ever tested. */
export default async function DailyNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: modeParam } = await searchParams;
  const mode: SessionMode = modeParam === "short" ? "short" : "full";

  const supabase = await createClient();
  const plan = await buildSessionPlan(supabase, new Date(), mode);

  const readingBlock = plan.blocks.find((b) => b.type === "reading");
  const newBlockIds = plan.blocks.filter((b) => b.type === "new").flatMap((b) => b.items.map((i) => i.card_id));

  // Cards belonging to today's reading span (all segments, all chapters).
  let readingCardIds: number[] = [];
  if (readingBlock?.reading) {
    const r = readingBlock.reading;
    const { data: book } = await supabase.from("books").select("id").eq("slug", r.book_slug).maybeSingle();
    if (book) {
      const { data: spanCards } = await supabase
        .from("cards")
        .select("id")
        .eq("book_id", book.id)
        .gte("chapter", r.ch_from)
        .lte("chapter", r.ch_to)
        .eq("active", true)
        .limit(NOTES_PER_GROUP);
      readingCardIds = (spanCards ?? []).map((c) => c.id);
    }
  }

  const readingSet = new Set(readingCardIds);
  const newOnlyIds = newBlockIds.filter((id) => !readingSet.has(id)).slice(0, NOTES_PER_GROUP);

  const [readingCards, newCards] = await Promise.all([
    loadReviewCards(supabase, readingCardIds),
    loadReviewCards(supabase, newOnlyIds),
  ]);

  const readingMinutes = Math.max(1, readingBlock?.est_minutes ?? 1);

  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-10">
      <FlowStepper stage={2} />
      <h1 className="text-2xl font-extrabold text-ink">Jegyzetek</h1>
      <p className="mt-1 text-sm text-ink-muted">Nézd át nyugodtan — ezekből lesz a mai kvíz.</p>

      {readingCards.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">A mai szakaszból</h2>
          <div className="mt-2">
            <NotesList cards={readingCards} />
          </div>
        </section>
      )}

      {newCards.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">Új kártyák a mai kvízben</h2>
          <div className="mt-2">
            <NotesList cards={newCards} startIndex={readingCards.length} />
          </div>
        </section>
      )}

      {readingCards.length === 0 && newCards.length === 0 && (
        <p className="mt-6 text-ink-muted">Ma nincs új anyag — irány az ismétlés.</p>
      )}

      <div className="mt-8">
        {readingBlock && plan.day_idx != null ? (
          <ReadingSessionCTA dayIdx={plan.day_idx} minutes={readingMinutes} mode={mode} />
        ) : (
          <ButtonLink size="lg" href={`/ma/session?mode=${mode}`}>
            Készen állok → Ismétlés indítása
          </ButtonLink>
        )}
      </div>
    </main>
  );
}
