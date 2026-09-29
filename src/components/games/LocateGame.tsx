"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useGameScore } from "@/lib/review/use-game-score";
import { SessionEnd } from "@/components/session/SessionEnd";
import type { PersistedCardState, FsrsRating } from "@/lib/fsrs/engine";

interface Item {
  id: number;
  prompt: string;
  payload: { verse_text: string; book_id: number; chapter: number };
  state: PersistedCardState;
}
interface BookOption {
  id: number;
  slug: string;
  short_hu: string;
}

export function LocateGame({ items, books }: { items: Item[]; books: BookOption[] }) {
  const [index, setIndex] = useState(0);
  const [pickedBook, setPickedBook] = useState<number | null>(null);
  const [chapterInput, setChapterInput] = useState("");
  const [result, setResult] = useState<{ bookOk: boolean; chapterOk: boolean } | null>(null);
  const [score, setScore] = useState(0);
  const { markStart, submit } = useGameScore("game:locate");

  const item = items[index];

  async function finishItem() {
    if (!item || pickedBook == null) return;
    const bookOk = pickedBook === item.payload.book_id;
    const chapterDiff = Math.abs(Number(chapterInput) - item.payload.chapter);
    const chapterOk = chapterDiff <= 2;
    setResult({ bookOk, chapterOk });

    let rating: FsrsRating;
    if (bookOk && chapterDiff === 0) rating = 4;
    else if (bookOk && chapterOk) rating = 3;
    else if (bookOk) rating = 2;
    else rating = 1;

    if (bookOk) setScore((s) => s + (chapterDiff === 0 ? 1 : chapterOk ? 0.7 : 0.5));
    await submit(item.id, item.state, rating);
  }

  function next() {
    setIndex((i) => i + 1);
    setPickedBook(null);
    setChapterInput("");
    setResult(null);
    markStart();
  }

  if (!item) {
    return (
      <div className="pop-in text-center">
        <SessionEnd />
        <p className="text-5xl">🔍</p>
        <p className="mt-2 text-3xl font-black text-ink">Kész!</p>
        <p className="mt-1 font-bold text-ink-muted">
          {Math.round(score * 10) / 10} / {items.length} pont
        </p>
        <ButtonLink href="/ma" className="mt-5">
          Vissza a mai naphoz
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-sky transition-[width]" style={{ width: `${(index / items.length) * 100}%` }} />
        </div>
        <span className="shrink-0 text-xs font-black text-ink-faint">
          {index + 1}/{items.length}
        </span>
      </div>
      <div className="mt-2 rounded-3xl border-2 border-line bg-surface p-5 font-serif text-lg leading-relaxed text-ink">
        {item.payload.verse_text}
      </div>

      {!result ? (
        <>
          <p className="mt-4 text-sm font-black text-ink-muted">Melyik könyv?</p>
          <div className="mt-2 grid grid-cols-6 gap-1.5">
            {books.map((b) => (
              <button
                key={b.id}
                onClick={() => setPickedBook(b.id)}
                className={cx(
                  "tap-target rounded-xl border-2 px-1 py-2 text-[11px] font-extrabold transition-colors",
                  pickedBook === b.id ? "border-sky bg-sky text-white" : "border-line bg-surface text-ink",
                )}
              >
                {b.short_hu}
              </button>
            ))}
          </div>

          {pickedBook != null && (
            <div className="mt-4 flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                autoFocus
                value={chapterInput}
                onChange={(e) => setChapterInput(e.target.value)}
                placeholder="Fejezet"
                className="w-full rounded-2xl border-2 border-line-strong bg-surface px-4 py-3 font-bold text-ink focus:border-sky focus:outline-none"
              />
              <Button onClick={finishItem}>Kész</Button>
            </div>
          )}
        </>
      ) : (
        <div
          className={cx(
            "pop-in mt-4 rounded-2xl border-2 p-4",
            result.bookOk && result.chapterOk && "border-good/40 bg-good/12",
            result.bookOk && !result.chapterOk && "border-gold/50 bg-gold/15",
            !result.bookOk && "border-bad/40 bg-bad/10",
          )}
        >
          <p className={cx("text-sm font-black", result.bookOk ? (result.chapterOk ? "text-good" : "text-gold-deep") : "text-bad")}>
            {result.bookOk ? (result.chapterOk ? "🎯 Telitalálat!" : "Jó könyv, más fejezet") : "Nem ez a könyv"}
          </p>
          <p className="mt-1 text-lg font-black text-ink">
            {books.find((b) => b.id === item.payload.book_id)?.short_hu} {item.payload.chapter}
          </p>
          <Button className="mt-3" onClick={next}>
            Következő
          </Button>
        </div>
      )}
    </div>
  );
}
