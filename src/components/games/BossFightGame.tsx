"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cx } from "@/lib/cx";
import { isExactMatch, isCloseMatch } from "@/lib/content/text";
import { useGameScore } from "@/lib/review/use-game-score";
import { getBossCards, applyBossBonus } from "@/app/(app)/jatekok/boss/actions";
import { BadgeToast } from "@/components/badges/BadgeToast";
import { SessionEnd } from "@/components/session/SessionEnd";
import type { PersistedCardState } from "@/lib/fsrs/engine";

interface BookOption {
  id: number;
  slug: string;
  name: string;
  count: number;
}
interface Item {
  id: number;
  prompt: string;
  answer: string;
  answer_alt: string[];
  options: string[];
  difficulty: number;
  state: PersistedCardState;
}

const QUESTION_SECONDS = 20;
/** Answers longer than this are unreasonable to type against a clock —
 * those fall back to multiple choice. Everything else must be recalled. */
const TYPED_MAX_CHARS = 32;

export function BossFightGame({ books }: { books: BookOption[] }) {
  const [book, setBook] = useState<BookOption | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [finished, setFinished] = useState(false);
  const [newBadges, setNewBadges] = useState<{ id: string; label_hu: string; description_hu: string }[]>([]);
  const { submit } = useGameScore("game:boss");
  const inputRef = useRef<HTMLInputElement>(null);

  const item = items?.[index];
  const isTyped = !!item && item.answer.length <= TYPED_MAX_CHARS;

  useEffect(() => {
    if (!items || finished || picked) return;
    if (secondsLeft <= 0) {
      void answer(null);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, items, finished, picked]);

  useEffect(() => {
    if (isTyped && !picked) inputRef.current?.focus();
  }, [index, isTyped, picked]);

  async function start(b: BookOption) {
    setBook(b);
    const cards = await getBossCards(b.id);
    setItems(cards);
  }

  async function answer(given: string | null) {
    if (!items || !item) return;
    const accepted = [item.answer, ...item.answer_alt];
    const correct =
      given != null && (isTyped ? isExactMatch(given, accepted) || accepted.some((a) => isCloseMatch(given, a)) : given === item.answer);
    setPicked(given ?? "__timeout__");
    setLastCorrect(correct);
    if (correct) setCorrectCount((c) => c + 1);
    await submit(item.id, item.state, correct ? 3 : 1);

    setTimeout(
      async () => {
        if (index + 1 >= items.length) {
          setFinished(true);
          const pct = ((correct ? correctCount + 1 : correctCount) / items.length) * 100;
          if (pct >= 85 && book) setNewBadges(await applyBossBonus(book.slug));
        } else {
          setIndex((i) => i + 1);
          setPicked(null);
          setTyped("");
          setLastCorrect(null);
          setSecondsLeft(QUESTION_SECONDS);
        }
      },
      correct ? 500 : 1800,
    );
  }

  if (!book) {
    return (
      <div className="mt-6 flex flex-col gap-2">
        {books.map((b) => (
          <Button key={b.id} variant="secondary" onClick={() => start(b)}>
            {b.name} ({b.count} kérdés)
          </Button>
        ))}
      </div>
    );
  }

  if (!items) {
    return <p className="mt-6 text-ink-muted">Betöltés…</p>;
  }

  if (finished || !item) {
    const pct = Math.round((correctCount / items.length) * 100);
    return (
      <div className="mt-8 text-center">
        <BadgeToast badges={newBadges} />
        <SessionEnd />
        <p className="text-3xl font-extrabold text-ink">{pct}%</p>
        <p className="mt-1 text-ink-muted">
          {correctCount} / {items.length} helyes — {book.name}
        </p>
        {pct >= 85 && <p className="mt-2 font-extrabold text-good">Mesterfokozat bónusz jóváírva!</p>}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-faint">
          {index + 1} / {items.length}
        </p>
        <p className={cx("text-lg font-extrabold", secondsLeft <= 5 ? "text-bad" : "text-ink")}>{secondsLeft}s</p>
      </div>
      <div className="mt-2 rounded-lg border border-line bg-surface p-6 text-center text-lg text-ink">{item.prompt}</div>

      {isTyped ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!picked) void answer(typed);
          }}
          className="mt-4 flex gap-2"
        >
          <Input ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Írd be a választ…" disabled={!!picked} autoFocus />
          <Button type="submit" disabled={!!picked}>
            OK
          </Button>
        </form>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2">
          {Array.from(new Set(item.options)).map((opt) => {
            const isCorrect = picked && opt === item.answer;
            const isWrongPick = picked === opt && opt !== item.answer;
            return (
              <button
                key={opt}
                onClick={() => answer(opt)}
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
      )}

      {picked && (
        <p className={cx("mt-3 text-center font-extrabold", lastCorrect ? "text-good" : "text-bad")}>
          {lastCorrect ? "Jó!" : `Helyes: ${item.answer}`}
        </p>
      )}
    </div>
  );
}
