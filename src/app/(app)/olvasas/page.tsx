import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { dayIndexForDate } from "@/lib/session/day-index";
import { SermonRecs } from "@/components/sermons/SermonRecs";

export default async function ReadingPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("program_start_date").eq("id", 1).maybeSingle();
  const programStart = settings?.program_start_date ?? new Date().toISOString().slice(0, 10);
  const dayIdx = dayIndexForDate(programStart, new Date());

  const { data: plan } = await supabase.from("reading_plan").select("*").eq("day_idx", dayIdx).maybeSingle();
  const { count: daysCompleted } = await supabase
    .from("reading_log")
    .select("day_idx", { count: "exact", head: true })
    .not("completed_at", "is", null);
  const { data: books } = await supabase.from("books").select("id, slug, name_hu");
  const bookById = new Map((books ?? []).map((b) => [b.slug, b]));

  const percent = Math.round(((daysCompleted ?? 0) / 365) * 100);

  return (
    <main className="mx-auto max-w-md px-4 pt-8">
      <h1 className="text-2xl font-extrabold text-ink">Olvasás</h1>
      <p className="mt-1 text-sm text-ink-muted">{dayIdx}. nap · {percent}% a 365 napból megvan</p>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
      </div>

      {plan ? (
        <Card className="mt-6 p-5">
          <p className="text-sm text-ink-muted">{["Váz", "Mélyfúrás", "Hálózat", "Konszolidáció"][plan.phase - 1] ?? ""} fázis</p>
          <div className="mt-2 flex flex-col gap-1">
            {plan.segments.map((seg, i) => (
              <p key={i} className="text-lg font-extrabold text-ink">
                {bookById.get(seg.book_slug)?.name_hu ?? seg.book_slug} {seg.ch_from}
                {seg.ch_to !== seg.ch_from ? `–${seg.ch_to}` : ""}
              </p>
            ))}
          </div>
          {plan.focus_note && (
            <p className="mt-3 rounded-md border border-line-strong bg-paper px-3 py-2 text-sm text-ink-muted">
              {plan.focus_note}
            </p>
          )}
          <p className="mt-3 text-sm text-ink-faint">becsült idő: {plan.est_minutes} perc</p>
          {plan.segments[0] && (
            <ButtonLink
              className="mt-4 w-full"
              href={`/olvasas/${plan.segments[0].book_slug}/${plan.segments[0].ch_from}`}
            >
              Olvasás indítása
            </ButtonLink>
          )}
        </Card>
      ) : (
        <p className="mt-6 text-ink-muted">
          A mai naphoz még nincs terv. Futtasd a <code>scripts/generate-reading-plan.ts</code> szkriptet.
        </p>
      )}

      {plan?.segments[0] && bookById.get(plan.segments[0].book_slug) && (
        <Suspense fallback={null}>
          <SermonRecs
            bookId={bookById.get(plan.segments[0].book_slug)!.id}
            chapter={plan.segments[0].ch_from}
            bookNameHu={bookById.get(plan.segments[0].book_slug)!.name_hu}
            focusNote={plan.focus_note}
          />
        </Suspense>
      )}

      <section className="mt-8">
        <ButtonLink href="/olvasas/konyvek" variant="secondary" size="lg" className="w-full">
          Szabad olvasás
        </ButtonLink>
      </section>
    </main>
  );
}
