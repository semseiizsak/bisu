"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";
import { useGameScore } from "@/lib/review/use-game-score";
import type { PersistedCardState } from "@/lib/fsrs/engine";

interface Item {
  id: number;
  prompt: string;
  answer: string;
  options: string[];
  state: PersistedCardState;
}

export function QuizGame({ items, mode }: { items: Item[]; mode: string }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const { submit } = useGameScore(mode);

  const item = items[index];

  async function pick(option: string) {
    if (picked) return;
    setPicked(option);
    const correct = option === item.answer;
    if (correct) setCorrectCount((c) => c + 1);
    await submit(item.id, item.state, correct ? 3 : 1);
    setTimeout(() => {
      setPicked(null);
      setIndex((i) => i + 1);
    }, 600);
  }

  if (!item) {
    return (
      <div className="mt-8 text-center">
        <p className="text-2xl font-extrabold text-ink">Kész!</p>
        <p className="mt-1 text-ink-muted">
          {correctCount} / {items.length} helyes
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-ink-faint">
        {index + 1} / {items.length}
      </p>
      <div className="mt-2 rounded-lg border border-line bg-surface p-6 text-center text-lg text-ink">{item.prompt}</div>
      <div className="mt-4 grid grid-cols-1 gap-2">
        {Array.from(new Set(item.options)).map((opt) => {
          const isCorrect = picked && opt === item.answer;
          const isWrongPick = picked === opt && opt !== item.answer;
          return (
            <button
              key={opt}
              onClick={() => pick(opt)}
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
