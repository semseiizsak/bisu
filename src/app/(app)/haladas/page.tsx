import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BOOKS } from "@/lib/content/books";
import { ERA_ORDER, ERA_LABELS } from "@/lib/content/eras";
import { masteryBucketClass } from "@/lib/mastery/color";
import { forecastDayToTarget } from "@/lib/mastery/forecast";
import { dayIndexForDate } from "@/lib/session/day-index";
import { computeStreak } from "@/lib/streak/compute";
import { checkAndAwardBadges } from "@/lib/badges/check";
import { reconcileXp } from "@/lib/xp/reconcile";
import { cx } from "@/lib/cx";
import { Card } from "@/components/ui/Card";
import { BadgeToast } from "@/components/badges/BadgeToast";

export default async function ProgressPage() {
  const supabase = await createClient();

  const [
    { data: settings },
    { data: bookMastery },
    { data: eraMastery },
    { data: weakScopes },
    { data: totalCardsRows },
    streak,
    { count: totalReviews },
    { count: masteredCards },
    newBadges,
  ] = await Promise.all([
    supabase.from("settings").select("program_start_date").eq("id", 1).maybeSingle(),
    supabase.from("mastery").select("scope_id, score, coverage, card_count").eq("scope_type", "book"),
    supabase.from("mastery").select("scope_id, score, card_count").eq("scope_type", "era"),
    supabase.from("mastery").select("scope_type, scope_id, score, card_count").gte("card_count", 5).order("score", { ascending: true }).limit(10),
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("active", true),
    computeStreak(supabase),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    supabase.from("card_states").select("card_id", { count: "exact", head: true }).gte("state", 2),
    checkAndAwardBadges(supabase),
  ]);

  const { data: allBadges } = await supabase
    .from("badges")
    .select("*")
    .order("category", { ascending: true })
    .order("threshold", { ascending: true });

  const programStart = settings?.program_start_date ?? new Date().toISOString().slice(0, 10);
  const dayIdx = dayIndexForDate(programStart, new Date());
  const xpSummary = await reconcileXp(supabase, dayIdx);

  const scoreByBookSlug = new Map((bookMastery ?? []).map((m) => [m.scope_id, m]));
  const scoreByEra = new Map((eraMastery ?? []).map((m) => [m.scope_id, m]));

  // --- retention curve (last 14 days daily accuracy) ------------------------
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { data: recentReviews } = await supabase.from("reviews").select("rating, reviewed_at").gte("reviewed_at", fourteenDaysAgo);
  const accByDay = new Map<string, { correct: number; total: number }>();
  for (const r of recentReviews ?? []) {
    const day = r.reviewed_at.slice(0, 10);
    if (!accByDay.has(day)) accByDay.set(day, { correct: 0, total: 0 });
    const bucket = accByDay.get(day)!;
    bucket.total++;
    if (r.rating >= 3) bucket.correct++;
  }
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10);
    const bucket = accByDay.get(d);
    return bucket ? bucket.correct / bucket.total : null;
  });

  // --- forecast ---------------------------------------------------------------
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: monthReviews } = await supabase.from("reviews").select("card_id, reviewed_at").gte("reviewed_at", thirtyDaysAgo).order("reviewed_at");
  const seenEver = new Set<number>();
  const cumulativeByDay: number[] = [];
  for (let i = 0; i < 30; i++) {
    const dayStr = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    for (const r of monthReviews ?? []) {
      if (r.card_id != null && r.reviewed_at.slice(0, 10) === dayStr) seenEver.add(r.card_id);
    }
    cumulativeByDay.push(seenEver.size);
  }
  const totalActive = totalCardsRows?.length ?? 0;
  const forecastDay = forecastDayToTarget(cumulativeByDay, totalActive, dayIdx);

  // --- weak point labels --------------------------------------------------
  const entityIds = (weakScopes ?? []).filter((s) => s.scope_type === "entity").map((s) => Number(s.scope_id.split(":")[1]));
  const { data: entities } = entityIds.length ? await supabase.from("entities").select("id, name_hu").in("id", entityIds) : { data: [] };
  const entityNameById = new Map((entities ?? []).map((e) => [e.id, e.name_hu]));
  const bookNameBySlug = new Map(BOOKS.map((b) => [b.slug, b.name_hu]));

  function weakLabel(scope: { scope_type: string; scope_id: string }) {
    if (scope.scope_type === "book") return bookNameBySlug.get(scope.scope_id) ?? scope.scope_id;
    if (scope.scope_type === "entity") return entityNameById.get(Number(scope.scope_id.split(":")[1])) ?? scope.scope_id;
    if (scope.scope_type === "era") return ERA_LABELS[scope.scope_id] ?? scope.scope_id;
    return scope.scope_id;
  }

  const statTiles = [
    { value: streak.current, label: "jelenlegi sorozat" },
    { value: streak.longest, label: "leghosszabb sorozat" },
    { value: totalReviews ?? 0, label: "ismétlés összesen" },
    { value: masteredCards ?? 0, label: "elsajátított kártya" },
    { value: xpSummary.level, label: "szint" },
  ];

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-6">
      <BadgeToast badges={newBadges} />
      <h1 className="text-2xl font-extrabold text-ink">Haladás</h1>
      <p className="mt-1 text-sm text-ink-muted">{dayIdx}. nap a 365-ből</p>

      {/* Stats strip */}
      <section className="mt-4 grid grid-cols-3 gap-2">
        {statTiles.map((s) => (
          <div key={s.label} className="rounded-md border border-line bg-surface p-2 text-center">
            <p className="text-lg font-extrabold text-ink">{s.value}</p>
            <p className="text-[11px] leading-tight text-ink-faint">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Heatmap */}
      <section className="mt-6">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">66 könyv</h2>
        <div className="mt-2 grid grid-cols-11 gap-1">
          {BOOKS.map((b) => {
            const m = scoreByBookSlug.get(b.slug);
            return (
              <div
                key={b.slug}
                title={`${b.name_hu}: ${m ? Math.round(m.score * 100) : 0}%`}
                className={`flex aspect-square items-center justify-center rounded text-[9px] font-medium ${masteryBucketClass(m?.score ?? 0)}`}
              >
                {b.order_idx}
              </div>
            );
          })}
        </div>
      </section>

      {/* Retention curve */}
      <section className="mt-8">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">Retenció (14 nap)</h2>
        <div className="mt-2 flex h-20 items-end gap-1">
          {last14.map((v, i) => (
            <div key={i} className="flex-1 rounded-t bg-line" style={{ height: "100%" }}>
              <div
                className="w-full rounded-t bg-accent"
                style={{ height: v == null ? "0%" : `${Math.max(4, v * 100)}%`, marginTop: v == null ? "100%" : `${100 - v * 100}%` }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Forecast */}
      <section className="mt-8">
        <Card className="p-4">
          <p className="text-sm text-ink-muted">Előrejelzés</p>
          <p className="mt-1 text-ink">
            {forecastDay
              ? `Ezzel a tempóval a ${forecastDay}. napra éred el a 90%-os lefedettséget.`
              : "Még nincs elég adat az előrejelzéshez — pár hét review után pontosabb lesz."}
          </p>
        </Card>
      </section>

      {/* Era timeline */}
      <section className="mt-8">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">Korszakok</h2>
        <div className="mt-2 flex flex-col gap-1">
          {ERA_ORDER.map((era) => {
            const m = scoreByEra.get(era);
            return (
              <div key={era} className="flex items-center gap-2">
                <div className={`h-4 flex-1 rounded ${masteryBucketClass(m?.score ?? 0)}`} />
                <span className="w-32 shrink-0 text-xs text-ink-muted">{ERA_LABELS[era]}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Weak points */}
      <section className="mt-8">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">Gyenge pontok</h2>
        <div className="mt-2 flex flex-col gap-2">
          {(weakScopes ?? []).map((s) => (
            <Card key={`${s.scope_type}:${s.scope_id}`} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="font-extrabold text-ink">{weakLabel(s)}</p>
                <p className="text-xs text-ink-faint">{Math.round(s.score * 100)}%</p>
              </div>
              <Link
                href={`/haladas/gyakorlas/${s.scope_type}/${encodeURIComponent(s.scope_id)}`}
                className="text-sm font-extrabold text-accent underline underline-offset-4"
              >
                Gyakorlom most
              </Link>
            </Card>
          ))}
          {(weakScopes ?? []).length === 0 && <p className="text-ink-muted">Még nincs elég adat.</p>}
        </div>
      </section>

      {/* Badges */}
      <section className="mt-8">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">Jelvények</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(allBadges ?? []).map((b) => (
            <div key={b.id} className={cx("rounded-md p-3", b.earned_at ? "bg-good/70" : "bg-line")}>
              <p className={cx("text-sm font-extrabold", b.earned_at ? "text-paper" : "text-ink-faint")}>{b.label_hu}</p>
              {b.earned_at && <p className="mt-0.5 text-xs text-paper/80">{b.description_hu}</p>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
