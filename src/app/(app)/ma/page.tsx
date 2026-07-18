import { createClient } from "@/lib/supabase/server";
import { buildSessionPlan } from "@/lib/session/build-session";
import { computeDayProgress } from "@/lib/session/day-progress";
import { computeStreak } from "@/lib/streak/compute";
import { checkAndAwardBadges } from "@/lib/badges/check";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DayRing } from "@/components/ui/DayRing";
import { StreakIcon } from "@/components/nav/icons";
import { BadgeToast } from "@/components/badges/BadgeToast";

const BLOCK_LABELS: Record<string, string> = {
  reading: "Olvasás",
  review: "Ismétlés",
  new: "Új kártyák",
  weak: "Gyenge pontok",
  game: "Játék",
  interleave: "Felfrissítés",
};

export default async function TodayPage() {
  const supabase = await createClient();
  const plan = await buildSessionPlan(supabase, new Date(), "full");
  const [progress, streak, newBadges] = await Promise.all([
    computeDayProgress(supabase, plan),
    computeStreak(supabase),
    checkAndAwardBadges(supabase),
  ]);

  const reviewCount = plan.blocks
    .filter((b) => ["review", "new", "weak", "interleave"].includes(b.type))
    .reduce((s, b) => s + b.items.length, 0);

  const readingBlock = plan.blocks.find((b) => b.type === "reading");
  const readingPending = !!readingBlock?.reading && progress.reading < 1;
  const canStartSession = reviewCount > 0 || readingPending;

  function sessionHref(mode: "full" | "short") {
    if (readingPending && readingBlock?.reading) {
      return `/olvasas/${readingBlock.reading.book_slug}/${readingBlock.reading.ch_from}?next=session&mode=${mode}`;
    }
    return `/ma/session?mode=${mode}`;
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8">
      <BadgeToast badges={newBadges} />
      <h1 className="text-2xl font-extrabold text-ink">Ma</h1>

      <div className="mt-4 flex items-center gap-4">
        <DayRing reading={progress.reading} srs={progress.srs} game={progress.game} />
        <div>
          <p className="text-sm text-ink-muted">
            {plan.day_idx ? `${plan.day_idx}. nap` : ""} · becsült idő: {plan.total_est} perc
          </p>
          {streak.current > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-extrabold text-accent">
              <StreakIcon width={16} height={16} />
              {streak.current} napos sorozat
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {plan.blocks.map((b, i) => (
          <Card key={i} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-extrabold text-ink">{BLOCK_LABELS[b.type] ?? b.type}</p>
              {b.reading && (
                <p className="text-sm text-ink-muted">
                  {b.reading.book_name} {b.reading.ch_from}
                  {b.reading.ch_to !== b.reading.ch_from ? `–${b.reading.ch_to}` : ""}
                </p>
              )}
              {b.type !== "reading" && b.type !== "game" && (
                <p className="text-sm text-ink-muted">{b.items.length} kártya</p>
              )}
            </div>
            <span className="text-sm font-extrabold text-ink-faint">{b.est_minutes}′</span>
          </Card>
        ))}
        {plan.blocks.length === 0 && <p className="text-ink-muted">Nincs ma mit tenni — pihenj.</p>}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {canStartSession && (
          <ButtonLink size="lg" href={sessionHref("full")}>
            Teljes nap ({plan.total_est}′)
          </ButtonLink>
        )}
        {canStartSession && (
          <ButtonLink size="lg" variant="secondary" href={sessionHref("short")}>
            Rövid (15′)
          </ButtonLink>
        )}
        <ButtonLink size="lg" variant="ghost" href="/olvasas">
          Csak olvasás
        </ButtonLink>
      </div>
    </main>
  );
}
