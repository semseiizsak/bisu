"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/Button";
import { useGameScore } from "@/lib/review/use-game-score";
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
      <div className="text-center">
        <p className="text-2xl font-extrabold text-ink">Kész!</p>
        <p className="mt-1 text-ink-muted">{Math.round(score * 10) / 10} / {items.length} pont</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-ink-faint">
        {index + 1} / {items.length}
      </p>
      <div className="mt-2 rounded-lg border border-line bg-surface p-5 font-serif text-lg leading-relaxed text-ink">
        {item.payload.verse_text}
      </div>

      {!result ? (
        <>
          <p className="mt-4 text-sm font-extrabold text-ink-muted">Melyik könyv?</p>
          <div className="mt-2 grid grid-cols-6 gap-1">
            {books.map((b) => (
              <button
                key={b.id}
                onClick={() => setPickedBook(b.id)}
                className={cx(
                  "rounded border px-1 py-1.5 text-[11px] font-medium transition-colors",
                  pickedBook === b.id ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink hover:border-ink/40",
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
                className="w-full rounded-md border border-line-strong bg-surface px-4 py-2.5 text-ink"
              />
              <Button onClick={finishItem}>Kész</Button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-md border border-line bg-surface p-4">
          <p className="font-extrabold text-ink">
            {books.find((b) => b.id === item.payload.book_id)?.short_hu} {item.payload.chapter}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {result.bookOk ? (result.chapterOk ? "Nagyon jó!" : "Jó könyv, más fejezet.") : "Nem ez a könyv."}
          </p>
          <Button className="mt-3" onClick={next}>
            Következő
          </Button>
        </div>
      )}
    </div>
  );
}
