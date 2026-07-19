"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { CardFace } from "@/components/review/CardFace";
import { RatingButtons } from "@/components/review/RatingButtons";
import { reviewCard, type FsrsRating } from "@/lib/fsrs/engine";
import { queuePendingReview, flushPendingReviews } from "@/lib/db/sync";
import type { ReviewCard } from "@/lib/review/types";

interface Props {
  cards: ReviewCard[];
  mode: string; // 'srs' | 'game:*'
  onComplete?: (stats: { correct: number; total: number }) => void;
  /** Hide the built-in "Kész!" screen — the daily session renders its own
   * breather/summary instead and unmounts this component on completion. */
  showSummary?: boolean;
  /** Per-card synthesized MCQ options (daily-session format mixing). */
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

  const rate = useCallback(
    async (rating: FsrsRating) => {
      if (!card) return;
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

      if (rating === 4 && typeof navigator !== "undefined" && navigator.onLine) {
        void (async () => {
          try {
            await flushPendingReviews();
            await fetch("/api/adaptive/variant", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cardId: card.id }),
            });
          } catch {
            // adaptive variation is a nice-to-have — never block the review flow on it
          }
        })();
      }

      controls.set({ x: 0, opacity: 1 });
      if (index + 1 >= cards.length) {
        setDone(true);
        onComplete?.({ correct: correctCount, total: cards.length });
      } else {
        setIndex((i) => i + 1);
        setRevealed(false);
        setSuggested(undefined);
      }
    },
    [card, controls, index, cards.length, mode, onComplete, correctCount],
  );

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
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-2xl font-extrabold text-ink">Kész!</p>
        <p className="text-ink-muted">
          {correctCount}/{cards.length} helyes válasz
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="h-1 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full bg-accent transition-[width] duration-[var(--dur-standard)] ease-[var(--ease-standard)]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-ink-faint">
        {index + 1} / {cards.length}
      </p>

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
    </div>
  );
}

export function useSessionSummary(cards: ReviewCard[]) {
  return useMemo(() => ({ total: cards.length }), [cards]);
}
