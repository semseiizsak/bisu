"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { advanceVerseStage } from "@/lib/actions/memory-verse";
import { Button } from "@/components/ui/Button";
import type { ReviewCard } from "@/lib/review/types";
import type { VersePayload } from "@/lib/content/card-payloads";

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function firstLetter(word: string): string {
  const m = word.match(/\p{L}/u);
  return m ? m[0] : "";
}

/** Stage 2 keeps the first letter visible (K___), stage 3 hides it too. */
function skeleton(word: string, stage: 2 | 3): string {
  const letters = (word.match(/\p{L}/gu) ?? []).length;
  if (letters === 0) return word; // pure punctuation token (e.g. a lone dash)
  const hiddenCount = stage === 2 ? Math.max(1, letters - 1) : letters;
  const blanks = "_".repeat(hiddenCount);
  return stage === 2 ? `${firstLetter(word)}${blanks}` : blanks;
}

interface Props {
  card: ReviewCard;
  onDone: (ok: boolean | null) => void;
}

const MAX_ATTEMPTS = 2;

/** First-letter method verse drill: stage 1 is a plain read-through, stages
 * 2-3 have the learner type each word's first letter in order to reveal it
 * (stage 2 shows the first letter as a hint, stage 3 doesn't). A flawless
 * pass advances the stage for next time; any miss keeps it in place. */
export function VerseTrainer({ card, onDone }: Props) {
  const payload = card.payload as VersePayload | null;
  const text = payload?.text ?? card.answer;
  const reference = payload?.reference ?? card.prompt;
  const stage = (payload?.stage ?? 1) as 1 | 2 | 3;
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  const [revealedCount, setRevealedCount] = useState(0);
  const [input, setInput] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [misses, setMisses] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [helpOptions, setHelpOptions] = useState<string[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage !== 1) inputRef.current?.focus();
  }, [stage]);

  function complete(cleanPass: boolean) {
    if (cleanPass && stage < 3) void advanceVerseStage(card.id, 1);
    onDone(cleanPass);
  }

  function confirmRead() {
    void advanceVerseStage(card.id, 1);
    onDone(true);
  }

  function revealCurrentWord(countsAsMiss: boolean) {
    const newMisses = countsAsMiss ? misses + 1 : misses;
    if (countsAsMiss) setMisses(newMisses);
    setHelpOptions(null);
    setAttempts(0);
    setInput("");
    const next = revealedCount + 1;
    setRevealedCount(next);
    if (next >= words.length) complete(newMisses === 0);
  }

  function handleInput(raw: string) {
    const word = words[revealedCount];
    if (!word) return;
    const typed = raw.slice(-1);
    setInput(typed);
    if (!typed) return;

    const expected = fold(firstLetter(word));
    if (expected && fold(typed) === expected) {
      revealCurrentWord(false);
      return;
    }
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setWrongFlash(true);
    setTimeout(() => setWrongFlash(false), 250);
    setInput("");
    if (nextAttempts >= MAX_ATTEMPTS) revealCurrentWord(true);
  }

  function openHelp() {
    const word = words[revealedCount];
    if (!word) return;
    const own = fold(word);
    const seen = new Set([own]);
    const distractors: string[] = [];
    for (const w of words) {
      if (distractors.length >= 2) break;
      const f = fold(w);
      if (seen.has(f)) continue;
      seen.add(f);
      distractors.push(w);
    }
    while (distractors.length < 2) distractors.push(["és", "az", "meg"][distractors.length] ?? "…");
    const options = [word, ...distractors];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    setHelpOptions(options);
  }

  function pickHelpOption(opt: string) {
    const word = words[revealedCount];
    if (opt === word) revealCurrentWord(true);
    else setHelpOptions(null);
  }

  if (stage === 1) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm font-extrabold text-ink-faint">{reference}</p>
        <div className="rounded-lg border border-line bg-surface p-6 text-center">
          <p className="font-serif text-lg leading-relaxed text-ink">{text}</p>
        </div>
        <Button size="lg" onClick={confirmRead}>
          Elolvastam, jöhet a gyakorlás
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-extrabold text-ink-faint">
        {reference} · {stage === 2 ? "Kezdőbetűk" : "Vakteszt"}
      </p>
      <div className="rounded-lg border border-line bg-surface p-6 text-center font-serif text-lg leading-relaxed text-ink">
        {words.map((w, i) => (
          <span key={i} className={cx("mr-1.5 inline-block", i === revealedCount && "text-accent")}>
            {i < revealedCount ? w : skeleton(w, stage)}
          </span>
        ))}
      </div>

      {helpOptions ? (
        <div className="flex flex-wrap justify-center gap-2">
          {helpOptions.map((opt, i) => (
            <Button key={`${opt}-${i}`} variant="secondary" onClick={() => pickHelpOption(opt)}>
              {opt}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => handleInput(e.target.value)}
            className={cx(
              "w-16 rounded-md border px-3 py-2 text-center text-lg font-extrabold text-ink focus:outline-none",
              wrongFlash ? "border-bad bg-bad/10" : "border-line-strong bg-surface",
            )}
            autoFocus
            placeholder="?"
            aria-label="A következő szó kezdőbetűje"
          />
          <Button type="button" variant="ghost" onClick={openHelp}>
            Súgó
          </Button>
        </div>
      )}

      <p className="text-center text-xs text-ink-faint">
        {revealedCount}/{words.length} szó
      </p>
    </div>
  );
}
