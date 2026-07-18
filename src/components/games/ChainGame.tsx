"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { isExactMatch, isCloseMatch } from "@/lib/content/text";
import { useGameScore } from "@/lib/review/use-game-score";
import type { PersistedCardState } from "@/lib/fsrs/engine";

interface Step {
  childName: string;
  parentName: string;
  cardId: number | null;
  state: PersistedCardState | null;
}

export function ChainGame({ steps, line }: { steps: Step[]; line: string }) {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [streak, setStreak] = useState(0);
  const [over, setOver] = useState(false);
  const { submit } = useGameScore("game:chain");

  const step = steps[index];
  const isFirst = index === 0;

  async function answer() {
    const correct = isExactMatch(input, [step.parentName]) || isCloseMatch(input, step.parentName);
    if (step.cardId && step.state) {
      await submit(step.cardId, step.state, correct ? 3 : 1);
    }
    if (correct) {
      setStreak((s) => s + 1);
      if (index + 1 >= steps.length) {
        setOver(true);
      } else {
        setIndex((i) => i + 1);
        setInput("");
      }
    } else {
      setOver(true);
    }
  }

  if (over) {
    return (
      <div className="mt-8 text-center">
        <p className="text-2xl font-extrabold text-ink">Streak: {streak}</p>
        <p className="mt-1 text-ink-muted">{line} vonal</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-ink-faint">Streak: {streak}</p>
      <div className="mt-2 rounded-lg border border-line bg-surface p-6 text-center">
        <p className="text-lg text-ink">
          Ki volt {isFirst ? step.childName : "az ő"} apja
          {!isFirst ? "" : ` (${step.childName})`}?
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          answer();
        }}
        className="mt-4 flex gap-2"
      >
        <Input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Válasz…" />
        <Button type="submit">Kész</Button>
      </form>
    </div>
  );
}
