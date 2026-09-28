import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildSessionPlan } from "@/lib/session/build-session";
import { computeDayProgress } from "@/lib/session/day-progress";
import { computeStreak } from "@/lib/streak/compute";
import { checkAndAwardBadges } from "@/lib/badges/check";
import { updateQuestProgress, fetchDailyQuests } from "@/lib/quests/progress";
import { reconcileXp } from "@/lib/xp/reconcile";
import { gameLabel } from "@/lib/content/games";
import { currentDayIndex } from "@/lib/session/current-day";
import { getDaySpan } from "@/lib/session/day-span";
import { PIPELINE_KIND } from "@/lib/pipeline/run";
import { cx } from "@/lib/cx";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DayRing } from "@/components/ui/DayRing";
import { StreakIcon } from "@/components/nav/icons";
import { BadgeToast } from "@/components/badges/BadgeToast";
import { QuestList } from "@/components/quests/QuestList";
import { QuestToast } from "@/components/quests/QuestToast";
import { SermonRecs } from "@/components/sermons/SermonRecs";
import { PipelineKick } from "@/components/reading/PipelineKick";

const SRS_BLOCK_TYPES = ["review", "new", "weak"];

type RowState = "done" | "partial" | "todo";

function StatusChip({ state, label }: { state: RowState; label: string }) {
  return (
    <span
      className={cx(
        "rounded-full px-2.5 py-1 text-xs font-extrabold",
        state === "done" && "bg-good/70 text-paper",
        state === "partial" && "bg-warn/25 text-ink",
        state === "todo" && "bg-line text-ink-faint",
      )}
    >
      {label}
    </span>
  );
}

export default async function TodayPage() {
  const supabase = await createClient();
  const now = new Date();

  // Wave 1: the day index is the only thing everything else depends on.
  const dayIdx = await currentDayIndex(supabase);

  // Wave 2: everything that only needs the day index, in parallel.
  const [plan, streak, xpSummary, newQuests, dueVerses, span] = await Promise.all([
    buildSessionPlan(supabase, now, "full", dayIdx),
    computeStreak(supabase, now),
    reconcileXp(supabase, dayIdx, now),
    updateQuestProgress(supabase, dayIdx, now),
    supabase
      .from("memory_verses")
      .select("card_id, cards!inner(active, card_states!inner(due_at, suspended))", { count: "exact", head: true })
      .eq("cards.active", true)
      .eq("cards.card_states.suspended", false)
      .lte("cards.card_states.due_at", now.toISOString()),
    getDaySpan(supabase, dayIdx),
  ]);

  // Wave 3: things that depend on the plan, the streak or the quest update.
  const bookSlugs = Array.from(new Set(span.chapters.map((c) => c.book_slug)));
  const [progress, newBadges, questRows, { data: runs }] = await Promise.all([
    computeDayProgress(supabase, plan, now),
    checkAndAwardBadges(supabase, streak),
    fetchDailyQuests(supabase, dayIdx),
    bookSlugs.length
      ? supabase.from("extraction_runs").select("book_slug, chapter").eq("kind", PIPELINE_KIND).in("book_slug", bookSlugs)
      : Promise.resolve({ data: [] as { book_slug: string; chapter: number }[] }),
  ]);
  const dueVerseCount = dueVerses.count ?? 0;

  // Today's chapters that have no questions yet — generate them now rather
  // than waiting for tonight's cron.
  const done = new Set((runs ?? []).map((r) => `${r.book_slug}:${r.chapter}`));
  const pendingChapters = span.chapters.filter((c) => !done.has(`${c.book_slug}:${c.chapter}`)).map((c) => ({ book: c.book_slug, chapter: c.chapter }));

  const readingBlock = plan.blocks.find((b) => b.type === "reading");
  const gameBlock = plan.blocks.find((b) => b.type === "game");
  const srsBlocks = plan.blocks.filter((b) => SRS_BLOCK_TYPES.includes(b.type));
  const srsPlanned = srsBlocks.reduce((s, b) => s + b.items.length, 0);
  const srsEstRaw = srsBlocks.reduce((s, b) => s + b.est_minutes, 0);
  const quizEst = srsPlanned > 0 ? Math.max(1, Math.round((srsEstRaw * progress.srsExpected) / srsPlanned)) : 0;
  const newCount = plan.blocks.find((b) => b.type === "new")?.items.length ?? 0;

  const readingDone = progress.reading >= 1;
  const quizState: RowState = progress.srsExpected === 0 || progress.srs >= 1 ? "done" : progress.srsDone > 0 ? "partial" : "todo";
  const gameState: RowState = progress.gameExpected === 0 || progress.game >= 1 ? "done" : progress.gameDone > 0 ? "partial" : "todo";

  interface ChecklistRow {
    key: string;
    title: string;
    desc: string;
    est: number;
    state: RowState;
    chip: string;
  }
  const rows: ChecklistRow[] = [];
  if (readingBlock?.reading) {
    const r = readingBlock.reading;
    rows.push({
      key: "reading",
      title: "Olvasás",
      desc: `${r.book_name} ${r.ch_from}${r.ch_to !== r.ch_from ? `–${r.ch_to}` : ""}`,
      est: readingBlock.est_minutes,
      state: readingDone ? "done" : "todo",
      chip: readingDone ? "Kész" : "hátra van",
    });
  }
  if (progress.srsExpected > 0) {
    rows.push({
      key: "quiz",
      title: "Ismétlés",
      desc: `${Math.min(progress.srsDone, progress.srsExpected)}/${progress.srsExpected} kérdés${newCount ? ` · ${newCount} új` : ""}`,
      est: quizEst,
      state: quizState,
      chip: quizState === "done" ? "Kész" : quizState === "partial" ? `${Math.min(progress.srsDone, progress.srsExpected)}/${progress.srsExpected}` : "hátra van",
    });
  }
  if (gameBlock) {
    rows.push({
      key: "game",
      title: "Játék",
      desc: gameBlock.game ? gameLabel(gameBlock.game.game) : "",
      est: gameBlock.est_minutes,
      state: gameState,
      chip: gameState === "done" ? "Kész" : gameState === "partial" ? "folyamatban" : "hátra van",
    });
  }

  const remainingMinutes = Math.round(
    rows.reduce((s, r) => {
      if (r.state === "done") return s;
      if (r.key === "quiz") return s + r.est * (1 - progress.srs);
      if (r.key === "game") return s + r.est * (1 - progress.game);
      return s + r.est;
    }, 0),
  );
  const allDone = rows.length > 0 && rows.every((r) => r.state === "done");

  const readingPending = !!readingBlock?.reading && !readingDone;
  const canStartSession = progress.srsExpected > 0 || readingPending;

  let sermonBook: { id: number; name_hu: string } | null = null;
  if (allDone && readingBlock?.reading) {
    const { data } = await supabase.from("books").select("id, name_hu").eq("slug", readingBlock.reading.book_slug).maybeSingle();
    sermonBook = data;
  }

  function sessionHref(mode: "full" | "short") {
    if (readingPending && readingBlock?.reading) {
      return `/olvasas/${readingBlock.reading.book_slug}/${readingBlock.reading.ch_from}?flow=daily&mode=${mode}`;
    }
    return `/ma/session?mode=${mode}`;
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8">
      <BadgeToast badges={newBadges} />
      <QuestToast dayIdx={dayIdx} quests={newQuests} />
      <h1 className="text-2xl font-extrabold text-ink">Ma</h1>

      <div className="mt-4 flex items-center gap-4">
        <DayRing reading={progress.reading} srs={progress.srs} game={progress.game} />
        <div>
          <p className="text-sm text-ink-muted">
            {`${dayIdx}. nap`}
            {allDone ? " · minden kész mára" : remainingMinutes > 0 ? ` · még kb. ${remainingMinutes} perc` : ""}
          </p>
          {streak.current > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-extrabold text-accent">
              <StreakIcon width={16} height={16} />
              {streak.current} napos sorozat
            </p>
          )}
          <p className="mt-1 text-sm font-extrabold text-ink-muted">
            Szint {xpSummary.level} · ma +{xpSummary.todayXp} XP
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {rows.map((r) => (
          <Card key={r.key} className={cx("flex items-center justify-between px-4 py-3", r.state === "done" && "opacity-60")}>
            <div>
              <p className="font-extrabold text-ink">{r.title}</p>
              {r.desc && <p className="text-sm text-ink-muted">{r.desc}</p>}
            </div>
            <div className="flex items-center gap-2">
              <StatusChip state={r.state} label={r.chip} />
              {r.state !== "done" && <span className="text-sm font-extrabold text-ink-faint">{r.est}′</span>}
            </div>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-ink-muted">Nincs ma mit tenni — pihenj.</p>}
        {pendingChapters.length > 0 && (
          <Card className="px-4 py-3">
            <PipelineKick chapters={pendingChapters} compact />
          </Card>
        )}
      </div>

      {dueVerseCount > 0 && (
        <Card className="mt-2 flex items-center justify-between px-4 py-3">
          <div>
            <p className="font-extrabold text-ink">Memoriter</p>
            <p className="text-sm text-ink-muted">{dueVerseCount} esedékes vers</p>
          </div>
          <ButtonLink href="/memoriter" size="sm" variant="secondary">
            Gyakorlom
          </ButtonLink>
        </Card>
      )}

      <QuestList quests={questRows} />

      <div className="mt-8 flex flex-col gap-3">
        {allDone ? (
          <>
            <p className="text-center font-extrabold text-good">A mai nap teljesítve ✓</p>
            <ButtonLink size="lg" variant="secondary" href="/ma/session?mode=short">
              Extra kör (10′)
            </ButtonLink>
            {sermonBook && readingBlock?.reading && (
              <Suspense fallback={null}>
                <SermonRecs
                  bookId={sermonBook.id}
                  chapter={readingBlock.reading.ch_from}
                  chapterTo={readingBlock.reading.ch_to}
                  bookNameHu={sermonBook.name_hu}
                  focusNote={readingBlock.reading.focus_note}
                />
              </Suspense>
            )}
          </>
        ) : (
          canStartSession && (
            <>
              <ButtonLink size="lg" href={sessionHref("full")}>
                {quizState === "partial" ? "Folytatás" : "Mai adag"} ({remainingMinutes}′)
              </ButtonLink>
              <ButtonLink size="lg" variant="secondary" href={sessionHref("short")}>
                Rövid (10′)
              </ButtonLink>
            </>
          )
        )}
        <ButtonLink size="lg" variant="ghost" href="/olvasas">
          Csak olvasás
        </ButtonLink>
      </div>
    </main>
  );
}
