import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/Button";
import { currentDayIndex } from "@/lib/session/current-day";
import { SermonRecs } from "@/components/sermons/SermonRecs";

const PHASES = ["Váz", "Mélyfúrás", "Hálózat", "Konszolidáció"];

export default async function ReadingPage() {
  const supabase = await createClient();
  const dayIdx = await currentDayIndex(supabase);

  const [{ data: plan }, { count: daysCompleted }, { data: books }, { data: log }] = await Promise.all([
    supabase.from("reading_plan").select("*").eq("day_idx", dayIdx).maybeSingle(),
    supabase.from("reading_log").select("day_idx", { count: "exact", head: true }).not("completed_at", "is", null),
    supabase.from("books").select("id, slug, name_hu"),
    supabase.from("reading_log").select("completed_at").eq("day_idx", dayIdx).maybeSingle(),
  ]);
  const bookById = new Map((books ?? []).map((b) => [b.slug, b]));
  const percent = Math.round(((daysCompleted ?? 0) / 365) * 100);
  const todayDone = !!log?.completed_at;
  const first = plan?.segments[0];
  const firstBook = first ? bookById.get(first.book_slug) : undefined;

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-black text-ink">Olvasás</h1>
        <p className="text-sm font-extrabold text-ink-muted">{daysCompleted ?? 0} / 365 nap</p>
      </div>
      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-sky" style={{ width: `${Math.max(2, percent)}%` }} />
      </div>

      {plan ? (
        <section className="mt-5 rounded-3xl border-2 border-sky/30 bg-sky/10 p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wide text-sky">
              {dayIdx}. nap · {PHASES[plan.phase - 1] ?? ""}
            </p>
            {todayDone && <span className="rounded-lg bg-good/15 px-2 py-0.5 text-xs font-black text-good">Kész ✓</span>}
          </div>
          <div className="mt-2 flex items-start gap-3">
            <span className="text-4xl">📖</span>
            <div className="flex flex-col">
              {plan.segments.map((seg, i) => (
                <p key={i} className="text-2xl font-black leading-tight text-ink">
                  {bookById.get(seg.book_slug)?.name_hu ?? seg.book_slug}{" "}
                  <span className="whitespace-nowrap">
                    {seg.ch_from}
                    {seg.ch_to !== seg.ch_from ? `–${seg.ch_to}` : ""}
                  </span>
                </p>
              ))}
              <p className="mt-1 text-sm font-bold text-ink-muted">kb. {plan.est_minutes} perc</p>
            </div>
          </div>
          {plan.focus_note && <p className="mt-3 rounded-2xl bg-surface px-3 py-2 text-sm font-semibold text-ink-muted">💡 {plan.focus_note}</p>}
          {first && (
            <ButtonLink className="mt-4 w-full" variant="sky" size="lg" href={`/olvasas/${first.book_slug}/${first.ch_from}?flow=daily&mode=full`}>
              {todayDone ? "Újraolvasom" : "Olvasás indítása"}
            </ButtonLink>
          )}
        </section>
      ) : (
        <p className="mt-6 text-ink-muted">
          A mai naphoz még nincs terv. Futtasd a <code>scripts/generate-reading-plan.ts</code> szkriptet.
        </p>
      )}

      <ButtonLink href="/olvasas/konyvek" variant="secondary" size="lg" className="mt-4 w-full">
        📚 Szabad olvasás
      </ButtonLink>

      {first && firstBook && (
        <details className="mt-6 rounded-2xl border-2 border-line bg-surface px-4 py-3">
          <summary className="cursor-pointer font-black text-ink">🎧 Prédikációk a mai fejezetekhez</summary>
          <Suspense fallback={null}>
            <SermonRecs bookId={firstBook.id} chapter={first.ch_from} chapterTo={first.ch_to} bookNameHu={firstBook.name_hu} focusNote={plan?.focus_note} />
          </Suspense>
        </details>
      )}
    </main>
  );
}
