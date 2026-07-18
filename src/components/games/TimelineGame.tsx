"use client";

import { useState } from "react";
import { Reorder } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useGameScore } from "@/lib/review/use-game-score";
import type { PersistedCardState } from "@/lib/fsrs/engine";

interface Props {
  cardId: number;
  prompt: string;
  payload: { items: { id: number; label: string }[]; correct_order: number[] };
  state: PersistedCardState;
}

export function TimelineGame({ cardId, prompt, payload, state }: Props) {
  const [order, setOrder] = useState(() => [...payload.items].sort(() => Math.random() - 0.5));
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const { submit } = useGameScore("game:timeline");

  async function check() {
    let correct = 0;
    order.forEach((item, i) => {
      if (payload.correct_order[i] === item.id) correct++;
    });
    setCorrectCount(correct);
    setChecked(true);
    const ratio = correct / order.length;
    const rating = ratio === 1 ? 4 : ratio >= 0.7 ? 3 : ratio >= 0.4 ? 2 : 1;
    await submit(cardId, state, rating);
  }

  return (
    <div className="mt-6">
      <p className="text-ink-muted">{prompt}</p>
      <p className="mt-1 text-sm text-ink-faint">Húzd a helyes sorrendbe (legrégebbi felül).</p>

      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="mt-4 flex flex-col gap-2">
        {order.map((item, i) => {
          const isCorrectPosition = checked && payload.correct_order[i] === item.id;
          const isWrongPosition = checked && payload.correct_order[i] !== item.id;
          return (
            <Reorder.Item
              key={item.id}
              value={item}
              className={
                "cursor-grab select-none rounded-md border p-3 font-medium text-ink transition-colors active:cursor-grabbing " +
                (isCorrectPosition
                  ? "border-good bg-good/10"
                  : isWrongPosition
                    ? "border-bad bg-bad/10"
                    : "border-line-strong bg-surface")
              }
            >
              {item.label}
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      {!checked ? (
        <Button className="mt-4 w-full" onClick={check}>
          Ellenőrzés
        </Button>
      ) : (
        <p className="mt-4 text-center font-extrabold text-ink">
          {correctCount} / {order.length} helyes pozíció
        </p>
      )}
    </div>
  );
}
