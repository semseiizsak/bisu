"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { isExactMatch, isCloseMatch } from "@/lib/content/text";
import type { ReviewCard } from "@/lib/review/types";
import type { McqPayload, ClozePayload, LocatePayload, NumericPayload } from "@/lib/content/card-payloads";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Props {
  card: ReviewCard;
  revealed: boolean;
  onReveal: (wasCorrect: boolean | null) => void;
  /** Present a non-mcq card as multiple choice with these options (the
   * daily session synthesizes them from sibling answers for variety). */
  mcqOptions?: string[];
}

export function CardFace({ card, revealed, onReveal, mcqOptions }: Props) {
  const [textAnswer, setTextAnswer] = useState("");
  const [nearMiss, setNearMiss] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    setTextAnswer("");
    setNearMiss(false);
    setSelectedOption(null);
    setShowContext(false);
  }, [card.id]);

  const accepted = [card.answer, ...card.answer_alt];

  function submitText() {
    if (!textAnswer.trim()) return onReveal(null);
    if (isExactMatch(textAnswer, accepted)) return onReveal(true);
    if (isCloseMatch(textAnswer, card.answer)) {
      setNearMiss(true);
      return;
    }
    onReveal(false);
  }

  function confirmNearMiss(accept: boolean) {
    setNearMiss(false);
    onReveal(accept);
  }

  function pickOption(option: string) {
    setSelectedOption(option);
    onReveal(option === card.answer);
  }

  const isTextType = ["recall", "reverse", "chain", "cloze", "locate"].includes(card.type);
  // Long answers (full verse text etc.) are unreasonable to force exact retyping of —
  // reveal and let the learner self-grade instead, like the non-text card types do.
  const isLongAnswer = card.answer.length > 24;
  const asSynthMcq = !!mcqOptions?.length && card.type !== "mcq" && card.type !== "numeric";
  const requiresTyping = isTextType && !isLongAnswer && !asSynthMcq;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-line bg-surface p-6 text-center">
        <p className="text-lg text-ink leading-relaxed whitespace-pre-line">{card.prompt}</p>
      </div>

      {!revealed && (card.type === "mcq" || asSynthMcq) && (
        <div className="grid grid-cols-1 gap-2">
          {Array.from(new Set(asSynthMcq ? mcqOptions! : ((card.payload as McqPayload)?.options ?? []))).map((opt) => (
            <Button key={opt} variant="secondary" onClick={() => pickOption(opt)}>
              {opt}
            </Button>
          ))}
        </div>
      )}

      {!revealed && card.type === "numeric" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onReveal(textAnswer.trim() === card.answer.trim());
          }}
          className="flex gap-2"
        >
          <Input
            type="number"
            inputMode="numeric"
            autoFocus
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder={(card.payload as NumericPayload)?.unit ?? "szám"}
          />
          <Button type="submit">Kész</Button>
        </form>
      )}

      {!revealed && requiresTyping && !nearMiss && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitText();
          }}
          className="flex gap-2"
        >
          <Input autoFocus value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} placeholder="Válasz…" />
          <Button type="submit">Kész</Button>
        </form>
      )}

      {nearMiss && (
        <div className="rounded-md border border-line-strong bg-surface p-4">
          <p className="text-ink">
            Ezt gondoltad? <strong className="font-extrabold">{card.answer}</strong>
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => confirmNearMiss(true)}>
              Jó
            </Button>
            <Button size="sm" variant="secondary" onClick={() => confirmNearMiss(false)}>
              Mégsem
            </Button>
          </div>
        </div>
      )}

      {!revealed && !requiresTyping && !asSynthMcq && card.type !== "mcq" && card.type !== "numeric" && (
        <Button variant="secondary" onClick={() => onReveal(null)}>
          Válasz felfedése (Space)
        </Button>
      )}

      {revealed && (
        <div className={cx("rounded-md border p-4", "border-line bg-surface")}>
          <p className="text-sm text-ink-muted">Helyes válasz</p>
          <p className="mt-1 text-lg font-extrabold text-ink">{card.answer}</p>
          {selectedOption && selectedOption !== card.answer && (
            <p className="mt-1 text-sm text-bad">A választásod: {selectedOption}</p>
          )}
          {card.verse_ref && (
            <button
              onClick={() => setShowContext((s) => !s)}
              className="mt-3 text-sm font-extrabold text-accent underline underline-offset-4"
            >
              {showContext ? "Kontextus elrejtése" : "Kontextus megnyitása"}
            </button>
          )}
          {showContext && (
            <p className="mt-2 rounded border border-line bg-paper p-3 font-serif text-ink">
              {(card.payload as ClozePayload)?.full_verse ?? (card.payload as LocatePayload)?.verse_text ?? card.verse_ref}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
