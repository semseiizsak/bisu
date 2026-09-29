"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { CardFace } from "@/components/review/CardFace";
import { RatingButtons } from "@/components/review/RatingButtons";
import { reviewCard, type FsrsRating } from "@/lib/fsrs/engine";
import { queuePendingReview } from "@/lib/db/sync";
import { flagCardNotImportant } from "@/lib/actions/questions";
import { advanceVerseStage } from "@/lib/actions/memory-verse";
import type { ReviewCard } from "@/lib/review/types";

interface Props {
  cards: ReviewCard[];
  mode: string; // 'srs' | 'game:*'
  onComplete?: (stats: { correct: number; total: number }) => void;
  /** Hide the built-in "Kész!" screen — the daily session renders its own
   * breather/summary instead and unmounts this component on completion. */
  showSummary?: boolean;
  /** Per-card multiple-choice options (see src/lib/session/interleave.ts). */
  mcqOptionsByCard?: Map<number, string[]>;
}

export function ReviewSession({ cards, mode, onComplete, showSummary = true, mcqOptionsByCard }: Props) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [suggested, setSuggested] = useState<FsrsRating | undefined>(undefined);
  const [done, setDone] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const startedAt = useRef(Date.now());
  const controls = useAnimation();

  const card = cards[index];
  const progress = cards.length ? Math.round((index / cards.length) * 100) : 0;

  useEffect(() => {
    startedAt.current = Date.now();
  }, [index]);

  const suggestRating = (correct: boolean | null): FsrsRating => {
    if (correct === true) return 3;
    if (correct === false) return 1;
    return 3; // unknown correctness (free reveal) defaults to "Good" as a neutral suggestion
  };

  const handleReveal = useCallback((correct: boolean | null) => {
    setSuggested(suggestRating(correct));
    setRevealed(true);
    if (correct) setCorrectCount((c) => c + 1);
  }, []);

  const advance = useCallback(() => {
    controls.set({ x: 0, opacity: 1 });
    if (index + 1 >= cards.length) {
      setDone(true);
      onComplete?.({ correct: correctCount, total: cards.length });
    } else {
      setIndex(index + 1);
      setRevealed(false);
      setSuggested(undefined);
    }
  }, [controls, index, cards.length, onComplete, correctCount]);

  const rate = useCallback(
    async (rating: FsrsRating) => {
      if (!card) return;
      // A drill's clean pass already advanced the stage optimistically —
      // "Again" here means the learner didn't actually feel confident, so
      // walk it back a step.
      if (card.type === "verse" && rating === 1) void advanceVerseStage(card.id, -1);
      const durationMs = Date.now() - startedAt.current;
      const { next, elapsedDays } = reviewCard(card.state, rating, new Date());

      await queuePendingReview({
        card_id: card.id,
        rating,
        state_before: card.state.state,
        elapsed_days: elapsedDays,
        duration_ms: durationMs,
        mode,
        reviewed_at: new Date().toISOString(),
        new_stability: next.stability ?? 0,
        new_difficulty: next.difficulty ?? 0,
        new_due_at: next.due_at ?? new Date().toISOString(),
        new_state: next.state,
        new_reps: next.reps,
        new_lapses: next.lapses,
      });

      advance();
    },
    [card, mode, advance],
  );

  // "Nem fontos" — retire the card and move on without a rating.
  const flagAndSkip = useCallback(() => {
    if (!card) return;
    void flagCardNotImportant(card.id).catch(() => {
      // best-effort: if offline/failed the card simply shows up again later
    });
    advance();
  }, [card, advance]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!revealed) {
        if (e.key === " ") {
          e.preventDefault();
          handleReveal(null);
        }
        return;
      }
      if (["1", "2", "3", "4"].includes(e.key)) {
        void rate(Number(e.key) as FsrsRating);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, handleReveal, rate]);

  const swipeThreshold = 100;

  if (!cards.length) {
    return <p className="text-ink-muted">Nincs ma esedékes kártya ebben a blokkban.</p>;
  }

  if (done) {
    if (!showSummary) return null;
    return (
      <div className="pop-in flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-5xl">🎉</p>
        <p className="text-2xl font-black text-ink">Kész!</p>
        <p className="font-bold text-ink-muted">
          {correctCount}/{cards.length} helyes válasz
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-good transition-[width] duration-[var(--dur-standard)] ease-[var(--ease-standard)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-black text-ink-faint">
          {index + 1}/{cards.length}
        </span>
      </div>

      <motion.div
        key={card.id}
        drag={revealed ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        animate={controls}
        onDragEnd={(_, info) => {
          if (info.offset.x < -swipeThreshold) void rate(1);
          else if (info.offset.x > swipeThreshold) void rate(3);
          else controls.start({ x: 0 });
        }}
      >
        <CardFace card={card} revealed={revealed} onReveal={handleReveal} mcqOptions={mcqOptionsByCard?.get(card.id)} />
      </motion.div>

      {revealed && <RatingButtons onRate={(r) => void rate(r)} suggested={suggested} />}

      <button onClick={flagAndSkip} className="mx-auto text-xs font-bold text-ink-faint underline underline-offset-4 hover:text-ink-muted">
        Nem fontos kérdés — elrejtés
      </button>
    </div>
  );
}
