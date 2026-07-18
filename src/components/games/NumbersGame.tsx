"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { numericDistractors } from "@/lib/content/distractors";
import { useGameScore } from "@/lib/review/use-game-score";
import type { PersistedCardState } from "@/lib/fsrs/engine";

interface Item {
  id: number;
  prompt: string;
  answer: string;
  unit: string | null;
  state: PersistedCardState;
}

export function NumbersGame({ items }: { items: Item[] }) {
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(null);
  const { markStart, submit } = useGameScore("game:numbers");

  const allValues = useMemo(() => items.map((i) => Number(i.answer)).filter((n) => Number.isFinite(n)), [items]);

  const round = items[index];
  const isContrast = index % 2 === 1;
  const contrastOptions = useMemo(() => {
    if (!round || !isContrast) return null;
    const correctVal = Number(round.answer);
    const [distractor] = numericDistractors(correctVal, allValues, round.id);
    const options = Math.random() > 0.5 ? [correctVal, distractor] : [distractor, correctVal];
    return options;
  }, [round, isContrast, allValues]);

  useEffect(() => {
    if (!running) return;
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [running, secondsLeft]);

  function start() {
    setRunning(true);
    markStart();
  }

  async function answer(value: number) {
    if (!round || feedback) return;
    const isCorrect = value === Number(round.answer);
    setFeedback(isCorrect ? "right" : "wrong");
    if (isCorrect) setCorrect((c) => c + 1);
    setAnswered((a) => a + 1);
    await submit(round.id, round.state, isCorrect ? 3 : 1);
    setTimeout(() => {
      setFeedback(null);
      setInput("");
      setIndex((i) => i + 1);
    }, 400);
  }

  const finished = !running || secondsLeft <= 0 || index >= items.length;

  if (!running) {
    return (
      <div className="mt-8 text-center">
        <p className="text-ink-muted">60 másodperc, annyi kérdés, amennyi belefér.</p>
        <Button className="mt-4" onClick={start}>
          Start
        </Button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="mt-8 text-center">
        <p className="text-2xl font-extrabold text-ink">Idő!</p>
        <p className="mt-1 text-ink-muted">
          {correct} / {answered} helyes
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-faint">
          {correct} / {answered}
        </p>
        <p className="text-lg font-extrabold text-ink">{secondsLeft}s</p>
      </div>

      <div className="mt-3 rounded-lg border border-line bg-surface p-5 text-center text-lg text-ink">{round.prompt}</div>

      {isContrast && contrastOptions ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {contrastOptions.map((opt, i) => (
            <Button key={i} variant="secondary" onClick={() => answer(opt)}>
              {opt}
            </Button>
          ))}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            answer(Number(input));
          }}
          className="mt-4 flex gap-2"
        >
          <Input
            type="number"
            inputMode="numeric"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={round.unit ?? "szám"}
          />
          <Button type="submit">OK</Button>
        </form>
      )}

      {feedback && (
        <p className={"mt-3 text-center font-extrabold " + (feedback === "right" ? "text-good" : "text-bad")}>
          {feedback === "right" ? "Jó!" : `Helyes: ${round.answer}`}
        </p>
      )}
    </div>
  );
}
