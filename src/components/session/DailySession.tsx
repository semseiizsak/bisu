"use client";

import { useEffect, useMemo, useState } from "react";
import { cx } from "@/lib/cx";
import { FlowStepper } from "@/components/session/FlowStepper";
import { ReviewSession } from "@/components/review/ReviewSession";
import { Button, ButtonLink } from "@/components/ui/Button";
import { flushPendingReviews } from "@/lib/db/sync";
import { buildMcqOptionsByCard, interleaveCards } from "@/lib/session/interleave";
import { BLITZ_QUESTIONS, BLITZ_SECONDS, QUIZ_ROUND_SIZE } from "@/lib/session/constants";
import { gameLabel } from "@/lib/content/games";
import { recordBlitzResult } from "@/lib/actions/blitz-result";
import { getXpSummary } from "@/lib/actions/xp-summary";
import type { XpSummary } from "@/lib/xp/reconcile";
import type { ReviewCard } from "@/lib/review/types";

interface Props {
  cards: ReviewCard[];
  game: string | null;
  streak: number;
  dayIdx: number | null;
}

type Phase =
  | { kind: "round"; idx: number }
  | { kind: "breather"; idx: number; roundCorrect: number; roundTotal: number }
  | { kind: "blitz"; idx: number }
  | { kind: "done" };

function chunk<T>(arr: T[], size: number): T[][] {
  const rounds = Math.max(1, Math.ceil(arr.length / size));
  const per = Math.ceil(arr.length / rounds);
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += per) out.push(arr.slice(i, i + per));
  return out;
}

/** Stage 3+4 of the guided daily session: the quiz in rounds of ~10-12 with
 * breather screens, a timed MCQ blitz between rounds for variety, and a
 * completion summary — instead of one flat, endless run of typed questions. */
export function DailySession({ cards, game, streak, dayIdx }: Props) {
  const mcqOptionsByCard = useMemo(() => buildMcqOptionsByCard(cards), [cards]);
  const ordered = useMemo(() => interleaveCards(cards, mcqOptionsByCard), [cards, mcqOptionsByCard]);
  const rounds = useMemo(() => chunk(ordered, QUIZ_ROUND_SIZE), [ordered]);

  const [phase, setPhase] = useState<Phase>({ kind: "round", idx: 0 });
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalDone, setTotalDone] = useState(0);
  const [xpSummary, setXpSummary] = useState<XpSummary | null>(null);

  useEffect(() => {
    void flushPendingReviews();
  }, []);

  useEffect(() => {
    if (phase.kind !== "done") return;
    void flushPendingReviews().then(() => getXpSummary(dayIdx)).then(setXpSummary);
  }, [phase.kind, dayIdx]);

  if (ordered.length === 0) {
    return (
      <div>
        <FlowStepper stage={3} />
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-ink-muted">Nincs ma esedékes kártya.</p>
          {game && <ButtonLink href={`/jatekok/${game}`}>Mai játék: {gameLabel(game)}</ButtonLink>}
        </div>
      </div>
    );
  }

  if (phase.kind === "done") {
    const pct = totalDone ? Math.round((totalCorrect / totalDone) * 100) : 0;
    return (
      <div>
        <FlowStepper stage={4} />
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-3xl font-extrabold text-ink">Kész a mai nap!</p>
          <p className="text-ink-muted">
            {totalCorrect}/{totalDone} helyes válasz ({pct}%)
          </p>
          {xpSummary && (
            <p className="text-sm font-extrabold text-accent">
              +{xpSummary.todayXp} XP ma · Szint {xpSummary.level}
            </p>
          )}
          {streak > 0 && <p className="text-sm font-extrabold text-accent">{streak} napos sorozat</p>}
          <div className="mt-4 flex flex-col gap-3">
            {game && (
              <ButtonLink size="lg" href={`/jatekok/${game}`}>
                Mai játék: {gameLabel(game)}
              </ButtonLink>
            )}
            <ButtonLink size="lg" variant={game ? "ghost" : "primary"} href="/ma">
              Vissza a mai naphoz
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  if (phase.kind === "breather") {
    const isLastRound = phase.idx + 1 >= rounds.length;
    const blitzPool = rounds[phase.idx].filter((c) => mcqOptionsByCard.has(c.id));
    const canBlitz = !isLastRound && blitzPool.length >= 2;
    const roundPct = phase.roundTotal ? Math.round((phase.roundCorrect / phase.roundTotal) * 100) : 0;
    return (
      <div>
        <FlowStepper stage={3} detail={`${phase.idx + 1}/${rounds.length}. kör kész`} />
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-3xl font-extrabold text-ink">{roundPct}%</p>
          <p className="text-ink-muted">
            {phase.roundCorrect}/{phase.roundTotal} helyes ebben a körben · összesen {totalDone}/{ordered.length} kártya
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {canBlitz && (
              <Button size="lg" onClick={() => setPhase({ kind: "blitz", idx: phase.idx })}>
                Villámkör ⚡
              </Button>
            )}
            <Button
              size="lg"
              variant={canBlitz ? "secondary" : "primary"}
              onClick={() => (isLastRound ? setPhase({ kind: "done" }) : setPhase({ kind: "round", idx: phase.idx + 1 }))}
            >
              {isLastRound ? "Összegzés" : "Következő kör"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase.kind === "blitz") {
    const items = rounds[phase.idx].filter((c) => mcqOptionsByCard.has(c.id)).slice(0, BLITZ_QUESTIONS);
    return (
      <div>
        <FlowStepper stage={3} detail="Villámkör" />
        <BlitzRound
          items={items}
          optionsByCard={mcqOptionsByCard}
          onDone={() => setPhase({ kind: "round", idx: phase.idx + 1 })}
        />
      </div>
    );
  }

  return (
    <div>
      <FlowStepper stage={3} detail={`${phase.idx + 1}. kör / ${rounds.length}`} />
      <ReviewSession
        key={phase.idx}
        cards={rounds[phase.idx]}
        mode="srs"
        showSummary={false}
        mcqOptionsByCard={mcqOptionsByCard}
        onComplete={({ correct, total }) => {
          setTotalCorrect((c) => c + correct);
          setTotalDone((d) => d + total);
          void flushPendingReviews();
          setPhase({ kind: "breather", idx: phase.idx, roundCorrect: correct, roundTotal: total });
        }}
      />
    </div>
  );
}

/** Timed MCQ reinforcement replay of the round just finished — pure game
 * feel, no FSRS writes (those already happened in the round proper). */
function BlitzRound({
  items,
  optionsByCard,
  onDone,
}: {
  items: ReviewCard[];
  optionsByCard: Map<number, string[]>;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(BLITZ_SECONDS);
  const [hits, setHits] = useState(0);

  const item = items[index];

  useEffect(() => {
    if (item || items.length === 0) return;
    void recordBlitzResult(hits, items.length);
    // Fires once per BlitzRound mount when it completes — items/hits are stable by then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  useEffect(() => {
    if (!item || picked) return;
    if (secondsLeft <= 0) {
      setPicked("__timeout__");
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, item, picked]);

  useEffect(() => {
    if (!picked) return;
    const t = setTimeout(() => {
      setPicked(null);
      setSecondsLeft(BLITZ_SECONDS);
      setIndex((i) => i + 1);
    }, 600);
    return () => clearTimeout(t);
  }, [picked]);

  if (!item) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-3xl font-extrabold text-ink">⚡ {hits}/{items.length}</p>
        <Button size="lg" onClick={onDone}>
          Következő kör
        </Button>
      </div>
    );
  }

  const options = optionsByCard.get(item.id) ?? [];
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-faint">
          {index + 1} / {items.length}
        </p>
        <p className={cx("text-lg font-extrabold", secondsLeft <= 5 ? "text-bad" : "text-ink")}>{secondsLeft}s</p>
      </div>
      <div className="mt-2 rounded-lg border border-line bg-surface p-6 text-center text-lg text-ink">{item.prompt}</div>
      <div className="mt-4 grid grid-cols-1 gap-2">
        {options.map((opt) => {
          const isCorrect = picked && opt === item.answer;
          const isWrongPick = picked === opt && opt !== item.answer;
          return (
            <button
              key={opt}
              onClick={() => {
                if (picked) return;
                setPicked(opt);
                if (opt === item.answer) setHits((h) => h + 1);
              }}
              disabled={!!picked}
              className={cx(
                "rounded-md border px-4 py-2.5 text-left font-medium transition-colors",
                isCorrect && "border-good bg-good/10 text-ink",
                isWrongPick && "border-bad bg-bad/10 text-ink",
                !picked && "border-line-strong bg-surface text-ink hover:border-ink/40",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
