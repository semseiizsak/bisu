"use client";

import { useState } from "react";
import { createManualCard } from "@/app/(app)/olvasas/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Verse {
  verse: number;
  text: string;
}

interface Props {
  verses: Verse[];
  bookId: number;
  bookShort: string;
  chapter: number;
}

export function ReaderClient({ verses, bookId, bookShort, chapter }: Props) {
  const [selection, setSelection] = useState<{ text: string; verse: number } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSelect() {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 2) {
      setSelection(null);
      return;
    }
    let node = sel?.anchorNode as HTMLElement | null;
    while (node && !(node instanceof HTMLElement && node.dataset.verse)) {
      node = node?.parentElement ?? null;
    }
    const verse = node ? Number(node.dataset.verse) : verses[0]?.verse ?? 1;
    setSelection({ text, verse });
    setSaved(false);
  }

  async function save() {
    if (!selection || !question.trim()) return;
    await createManualCard({
      prompt: question.trim(),
      answer: selection.text,
      book_id: bookId,
      chapter,
      verse_ref: `${bookShort} ${chapter}:${selection.verse}`,
    });
    setSaved(true);
    setFormOpen(false);
    setQuestion("");
  }

  return (
    <div>
      <div
        onMouseUp={handleSelect}
        onTouchEnd={handleSelect}
        className="font-serif text-[18px] leading-[1.7] text-ink"
      >
        {verses.map((v) => (
          <span key={v.verse} data-verse={v.verse}>
            <sup className="mr-1 select-none text-ink-faint">{v.verse}</sup>
            {v.text}{" "}
          </span>
        ))}
      </div>

      {selection && (
        <div className="fixed inset-x-0 bottom-20 z-30 mx-auto max-w-md px-4">
          <div className="rounded-lg border border-line-strong bg-surface p-4 shadow-lg">
            <p className="text-sm text-ink-muted">
              Kijelölve: <span className="italic">&ldquo;{selection.text}&rdquo;</span>
            </p>
            {!formOpen ? (
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  Tény kiemelése
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelection(null)}>
                  Bezár
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <Input
                  autoFocus
                  placeholder="Kérdés (pl. Mi volt...?)"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={save}>
                    Mentés kártyaként
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setFormOpen(false)}>
                    Mégsem
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {saved && <p className="mt-3 text-sm text-good">Kártya létrehozva.</p>}
    </div>
  );
}
