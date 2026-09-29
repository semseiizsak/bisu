import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BOOKS } from "@/lib/content/books";
import { ERA_ORDER, ERA_LABELS } from "@/lib/content/eras";
import { masteryBucketClass } from "@/lib/mastery/color";
import { forecastDayToTarget } from "@/lib/mastery/forecast";
import { currentDayIndex } from "@/lib/session/current-day";
import { computeStreak } from "@/lib/streak/compute";
import { badgeMetrics, checkAndAwardBadges } from "@/lib/badges/check";
import { reconcileXp } from "@/lib/xp/reconcile";
import { xpToNextLevel } from "@/lib/xp/constants";
import { getOrGenerateCoachReport } from "@/lib/coach/generate";
import { cx } from "@/lib/cx";
import { BadgeToast } from "@/components/badges/BadgeToast";
import { BadgeGrid } from "@/components/badges/BadgeGrid";
import { CoachReport } from "@/components/coach/CoachReport";

export default async function ProgressPage() {
  const supabase = await createClient();

  const [dayIdx, streak] = await Promise.all([currentDayIndex(supabase), computeStreak(supabase)]);
  const metrics = await badgeMetrics(supabase, streak);

  const [{ data: bookMastery }, { data: eraMastery }, { data: weakScopes }, { count: totalActive }, newBadges, { data: allBadges }, xpSummary, coachReport] =
    await Promise.all([
      supabase.from("mastery").select("scope_id, score, coverage, card_count").eq("scope_type", "book"),
      supabase.from("mastery").select("scope_id, score, card_count").eq("scope_type", "era"),
      supabase.from("mastery").select("scope_type, scope_id, score, card_count").gte("card_count", 5).order("score", { ascending: true }).limit(3),
      supabase.from("cards").select("id", { count: "exact", head: true }).eq("active", true),
      checkAndAwardBadges(supabase, streak, metrics),
      supabase.from("badges").select("*").order("category", { ascending: true }).order("threshold", { ascending: true }),
      reconcileXp(supabase, dayIdx),
      getOrGenerateCoachReport(supabase),
    ]);

  const scoreByBookSlug = new Map((bookMastery ?? []).map((m) => [m.scope_id, m]));
  const scoreByEra = new Map((eraMastery ?? []).map((m) => [m.scope_id, m]));
  const booksStarted = (bookMastery ?? []).filter((m) => m.score > 0).length;

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
  const forecastDay = forecastDayToTarget(cumulativeByDay, totalActive ?? 0, dayIdx);

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

  const { current, next, level } = xpToNextLevel(xpSummary.totalXp);
  const levelPct = next > current ? Math.round(((xpSummary.totalXp - current) / (next - current)) * 100) : 100;

  const tiles = [
    { emoji: "🔥", value: streak.current, label: "napos sorozat", tone: "bg-accent/12" },
    { emoji: "🏅", value: streak.longest, label: "rekord sorozat", tone: "bg-gold/18" },
    { emoji: "🧠", value: Math.round(metrics.coverage * (totalActive ?? 0)), label: "kérdés a fejedben", tone: "bg-good/12" },
    { emoji: "📚", value: booksStarted, label: "könyv elkezdve", tone: "bg-sky/12" },
  ];

  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-6">
      <BadgeToast badges={newBadges} />

      {/* Level hero */}
      <section className="flex items-center gap-4">
        <div className="shine flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-3xl bg-violet text-white shadow-[0_5px_0_0_var(--color-violet-deep)]">
          <span className="text-[10px] font-black uppercase tracking-wide opacity-80">Szint</span>
          <span className="text-4xl font-black leading-none">{level}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-ink">Haladás</h1>
          <p className="text-sm font-bold text-ink-muted">
            {dayIdx}. nap a 365-ből · {xpSummary.totalXp} XP
          </p>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-violet" style={{ width: `${Math.max(3, levelPct)}%` }} />
          </div>
          <p className="mt-1 text-xs font-bold text-ink-faint">még {next - xpSummary.totalXp} XP a következő szintig</p>
        </div>
      </section>

      {/* Stat tiles */}
      <section className="mt-5 grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className={cx("flex items-center gap-3 rounded-2xl px-4 py-3", t.tone)}>
            <span className="text-2xl">{t.emoji}</span>
            <div>
              <p className="text-2xl font-black leading-none text-ink">{t.value}</p>
              <p className="text-xs font-bold text-ink-muted">{t.label}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="mt-8">
        <BadgeGrid badges={allBadges ?? []} metrics={metrics} />
      </div>

      {coachReport && (
        <div className="mt-8">
          <CoachReport body={coachReport.body} />
        </div>
      )}

      {/* Heatmap */}
      <section className="mt-8">
        <h2 className="text-lg font-black text-ink">66 könyv</h2>
        <div className="mt-3 grid grid-cols-11 gap-1">
          {BOOKS.map((b) => {
            const m = scoreByBookSlug.get(b.slug);
            return (
              <div
                key={b.slug}
                title={`${b.name_hu}: ${m ? Math.round(m.score * 100) : 0}%`}
                className={`flex aspect-square items-center justify-center rounded-md text-[9px] font-extrabold ${masteryBucketClass(m?.score ?? 0)}`}
              >
                {b.order_idx}
              </div>
            );
          })}
        </div>
      </section>

      {/* Weak points */}
      {(weakScopes ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-black text-ink">Gyenge pontok</h2>
          <div className="mt-3 flex flex-col gap-2">
            {(weakScopes ?? []).map((s) => (
              <Link
                key={`${s.scope_type}:${s.scope_id}`}
                href={`/haladas/gyakorlas/${s.scope_type}/${encodeURIComponent(s.scope_id)}`}
                className="tap-target press flex items-center justify-between rounded-2xl border-2 border-line bg-surface px-4 py-3 shadow-[0_3px_0_0_var(--color-line-strong)]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🎯</span>
                  <div>
                    <p className="font-black text-ink">{weakLabel(s)}</p>
                    <p className="text-xs font-bold text-ink-faint">{Math.round(s.score * 100)}%</p>
                  </div>
                </div>
                <span className="text-sm font-black text-accent">Gyakorlom →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* The nerdier stats, folded away. */}
      <details className="mt-8 rounded-2xl border-2 border-line bg-surface px-4 py-3">
        <summary className="cursor-pointer font-black text-ink">📊 Több statisztika</summary>

        <p className="mt-4 text-xs font-black uppercase tracking-wide text-ink-faint">Retenció (14 nap)</p>
        <div className="mt-2 flex h-20 items-end gap-1">
          {last14.map((v, i) => (
            <div key={i} className="flex-1 rounded-t bg-line" style={{ height: "100%" }}>
              <div
                className="w-full rounded-t bg-good"
                style={{ height: v == null ? "0%" : `${Math.max(4, v * 100)}%`, marginTop: v == null ? "100%" : `${100 - v * 100}%` }}
              />
            </div>
          ))}
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-wide text-ink-faint">Előrejelzés</p>
        <p className="mt-1 text-sm font-semibold text-ink">
          {forecastDay
            ? `Ezzel a tempóval a ${forecastDay}. napra éred el a 90%-os lefedettséget.`
            : "Még nincs elég adat — pár hét után pontosabb lesz."}
        </p>

        <p className="mt-5 text-xs font-black uppercase tracking-wide text-ink-faint">Korszakok</p>
        <div className="mt-2 flex flex-col gap-1">
          {ERA_ORDER.map((era) => {
            const m = scoreByEra.get(era);
            return (
              <div key={era} className="flex items-center gap-2">
                <div className={`h-3 flex-1 rounded-full ${masteryBucketClass(m?.score ?? 0)}`} />
                <span className="w-32 shrink-0 text-xs font-bold text-ink-muted">{ERA_LABELS[era]}</span>
              </div>
            );
          })}
        </div>

        <p className="mt-5 text-xs font-bold text-ink-faint">{metrics.reviews} ismétlés összesen</p>
      </details>
    </main>
  );
}
