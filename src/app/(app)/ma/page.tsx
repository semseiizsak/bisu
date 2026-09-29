import { Suspense } from "react";
import Link from "next/link";
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
import { ButtonLink } from "@/components/ui/Button";
import { BadgeToast } from "@/components/badges/BadgeToast";
import { QuestToast } from "@/components/quests/QuestToast";
import { SermonRecs } from "@/components/sermons/SermonRecs";
import { PipelineKick } from "@/components/reading/PipelineKick";
import { TodayHero } from "@/components/today/TodayHero";
import { DayPath, type PathStep } from "@/components/today/DayPath";
import { DayComplete } from "@/components/today/DayComplete";
import { BonusChips } from "@/components/today/BonusChips";

const SRS_BLOCK_TYPES = ["review", "new", "weak"];

export default async function TodayPage() {
  const supabase = await createClient();
  const now = new Date();

  // Wave 1: the day index is the only thing everything else depends on.
  const dayIdx = await currentDayIndex(supabase);

  // Wave 2: everything that only needs the day index, in parallel.
  const [plan, streak, xpSummary, newQuests, dueVerses, span, nextSpan] = await Promise.all([
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
    getDaySpan(supabase, dayIdx + 1),
  ]);

  // Wave 3: things that depend on the plan, the streak or the quest update.
  const upcoming = [...span.chapters, ...nextSpan.chapters];
  const bookSlugs = Array.from(new Set(upcoming.map((c) => c.book_slug)));
  const [progress, newBadges, questRows, { data: runs }] = await Promise.all([
    computeDayProgress(supabase, plan, now),
    checkAndAwardBadges(supabase, streak),
    fetchDailyQuests(supabase, dayIdx),
    bookSlugs.length
      ? supabase.from("extraction_runs").select("book_slug, chapter").eq("kind", PIPELINE_KIND).in("book_slug", bookSlugs)
      : Promise.resolve({ data: [] as { book_slug: string; chapter: number }[] }),
  ]);
  const dueVerseCount = dueVerses.count ?? 0;

  const done = new Set((runs ?? []).map((r) => `${r.book_slug}:${r.chapter}`));
  const pendingChapters = upcoming.filter((c) => !done.has(`${c.book_slug}:${c.chapter}`)).map((c) => ({ book: c.book_slug, chapter: c.chapter }));

  const readingBlock = plan.blocks.find((b) => b.type === "reading");
  const gameBlock = plan.blocks.find((b) => b.type === "game");
  const srsBlocks = plan.blocks.filter((b) => SRS_BLOCK_TYPES.includes(b.type));
  const srsPlanned = srsBlocks.reduce((s, b) => s + b.items.length, 0);
  const srsEstRaw = srsBlocks.reduce((s, b) => s + b.est_minutes, 0);
  const quizEst = srsPlanned > 0 ? Math.max(1, Math.round((srsEstRaw * progress.srsExpected) / srsPlanned)) : 0;

  const readingDone = progress.reading >= 1;
  const quizDone = progress.srsExpected === 0 || progress.srs >= 1;
  const gameDone = progress.gameExpected === 0 || progress.game >= 1;
  const srsShown = Math.min(progress.srsDone, progress.srsExpected);

  const steps: PathStep[] = [];
  if (readingBlock?.reading) {
    const r = readingBlock.reading;
    steps.push({
      key: "reading",
      emoji: "📖",
      tone: "sky",
      title: "Olvasás",
      desc: `${r.book_name} ${r.ch_from}${r.ch_to !== r.ch_from ? `–${r.ch_to}` : ""}`,
      state: readingDone ? "done" : "todo",
      href: `/olvasas/${r.book_slug}/${r.ch_from}?flow=daily&mode=full`,
      minutes: readingBlock.est_minutes,
    });
  }
  if (progress.srsExpected > 0) {
    steps.push({
      key: "quiz",
      emoji: "🧠",
      tone: "accent",
      title: "Kvíz",
      desc: `${progress.srsExpected} kérdés a mai fejezetekből`,
      state: quizDone ? "done" : "todo",
      href: "/ma/session?mode=full",
      minutes: Math.max(1, Math.round(quizEst * (1 - progress.srs))),
      progress: progress.srsDone > 0 && !quizDone ? `${srsShown}/${progress.srsExpected}` : undefined,
    });
  }
  if (gameBlock) {
    steps.push({
      key: "game",
      emoji: "🎮",
      tone: "violet",
      title: "Játék",
      desc: gameBlock.game ? gameLabel(gameBlock.game.game) : "",
      state: gameDone ? "done" : "todo",
      href: gameBlock.game ? `/jatekok/${gameBlock.game.game}` : "/jatekok",
      minutes: gameBlock.est_minutes,
    });
  }
  // The first unfinished step is "current"; everything after it stays quiet.
  const currentStep = steps.find((s) => s.state !== "done");
  if (currentStep) currentStep.state = "current";

  const remainingMinutes = steps.filter((s) => s.state !== "done").reduce((s, st) => s + (st.minutes ?? 0), 0);
  const allDone = steps.length > 0 && steps.every((s) => s.state === "done");

  let sermonBook: { id: number; name_hu: string } | null = null;
  if (allDone && readingBlock?.reading) {
    const { data } = await supabase.from("books").select("id, name_hu").eq("slug", readingBlock.reading.book_slug).maybeSingle();
    sermonBook = data;
  }

  const ctaLabel = !currentStep
    ? ""
    : currentStep.key === "reading"
      ? "Kezdjük: olvasás"
      : currentStep.key === "quiz"
        ? progress.srsDone > 0
          ? "Kvíz folytatása"
          : "Kvíz indítása"
        : `Mai játék: ${currentStep.desc}`;
  const subtitle = allDone ? "Minden kész mára 🎉" : remainingMinutes > 0 ? `Még kb. ${remainingMinutes} perc` : "Mai adag";

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <BadgeToast badges={newBadges} />
      <QuestToast dayIdx={dayIdx} quests={newQuests} />

      <TodayHero dayIdx={dayIdx} streak={streak.current} totalXp={xpSummary.totalXp} todayXp={xpSummary.todayXp} subtitle={subtitle} />

      {steps.length > 0 ? <DayPath steps={steps} /> : <p className="mt-8 text-center text-ink-muted">Nincs ma mit tenni — pihenj. 🌿</p>}

      {pendingChapters.length > 0 && (
        <div className="-mt-2 mb-4">
          <PipelineKick chapters={pendingChapters} compact />
        </div>
      )}

      {allDone ? (
        <DayComplete todayXp={xpSummary.todayXp} streak={streak.current} />
      ) : (
        currentStep && (
          <div className="flex flex-col items-center gap-3">
            <ButtonLink size="lg" href={currentStep.href} className="w-full">
              {ctaLabel}
              {currentStep.minutes ? <span className="font-bold opacity-80">· {currentStep.minutes}′</span> : null}
            </ButtonLink>
            {!quizDone && progress.srsExpected > 0 && (
              <Link href="/ma/session?mode=short" className="text-sm font-extrabold text-ink-muted underline underline-offset-4">
                Csak egy gyors 10 perces kör
              </Link>
            )}
          </div>
        )
      )}

      {dueVerseCount > 0 && (
        <Link
          href="/memoriter"
          className="tap-target mt-4 flex items-center justify-between rounded-2xl border-2 border-line bg-surface px-4 py-3"
        >
          <span className="font-black text-ink">
            📜 Memoriter <span className="ml-1 rounded-lg bg-accent/12 px-2 py-0.5 text-xs text-accent">{dueVerseCount} esedékes</span>
          </span>
          <span className="text-sm font-extrabold text-ink-muted">Gyakorlom →</span>
        </Link>
      )}

      <div className="mt-6">
        <BonusChips quests={questRows} />
      </div>

      {allDone && sermonBook && readingBlock?.reading && (
        <details className="mt-6 rounded-2xl border-2 border-line bg-surface px-4 py-3">
          <summary className="cursor-pointer font-black text-ink">🎧 Prédikációk a mai fejezetekhez</summary>
          <Suspense fallback={null}>
            <SermonRecs
              bookId={sermonBook.id}
              chapter={readingBlock.reading.ch_from}
              chapterTo={readingBlock.reading.ch_to}
              bookNameHu={sermonBook.name_hu}
              focusNote={readingBlock.reading.focus_note}
            />
          </Suspense>
        </details>
      )}
    </main>
  );
}
