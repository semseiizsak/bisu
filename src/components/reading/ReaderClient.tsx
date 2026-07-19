"use client";

import { useState } from "react";
import { createManualCard, suggestCard } from "@/app/(app)/olvasas/actions";
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
  const [answer, setAnswer] = useState("");
  const [answerAlt, setAnswerAlt] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [saving, setSaving] = useState(false);
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
    const verse = node ? Number(node.dataset.verse) : (verses[0]?.verse ?? 1);
    setSelection({ text, verse });
    setSaved(false);
    setAiError(false);
  }

  function openForm() {
    if (!selection) return;
    setQuestion("");
    setAnswer(selection.text);
    setAnswerAlt([]);
    setFormOpen(true);
  }

  async function fillWithAi() {
    if (!selection || aiLoading) return;
    setAiLoading(true);
    setAiError(false);
    try {
      const suggestion = await suggestCard({
        text: selection.text,
        verseRef: `${bookShort} ${chapter}:${selection.verse}`,
      });
      setQuestion(suggestion.question);
      setAnswer(suggestion.answer);
      setAnswerAlt(suggestion.answer_alt);
      setFormOpen(true);
    } catch {
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  }

  async function save() {
    if (!selection || !question.trim() || !answer.trim() || saving) return;
    setSaving(true);
    try {
      await createManualCard({
        prompt: question.trim(),
        answer: answer.trim(),
        answer_alt: answerAlt,
        book_id: bookId,
        chapter,
        verse_ref: `${bookShort} ${chapter}:${selection.verse}`,
      });
      setSaved(true);
      setFormOpen(false);
      setQuestion("");
      setAnswer("");
      setAnswerAlt([]);
      setSelection(null);
    } finally {
      setSaving(false);
    }
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
            <p className="line-clamp-2 text-sm text-ink-muted">
              Kijelölve: <span className="italic">&ldquo;{selection.text}&rdquo;</span>
            </p>
            {!formOpen ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={fillWithAi} disabled={aiLoading}>
                  {aiLoading ? "Kérdés készül…" : "AI kérdés ✨"}
                </Button>
                <Button size="sm" variant="secondary" onClick={openForm}>
                  Kézzel írom
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelection(null)}>
                  Bezár
                </Button>
                {aiError && <p className="w-full text-xs text-bad">Nem sikerült — próbáld újra, vagy írd kézzel.</p>}
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <label className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Kérdés</label>
                <Input
                  autoFocus
                  placeholder="Kérdés (pl. Mi volt...?)"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <label className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Válasz</label>
                <Input placeholder="Válasz" value={answer} onChange={(e) => setAnswer(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={save} disabled={saving || !question.trim() || !answer.trim()}>
                    {saving ? "Mentés…" : "Mentés kártyaként"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={fillWithAi} disabled={aiLoading}>
                    {aiLoading ? "…" : "AI újra ✨"}
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
