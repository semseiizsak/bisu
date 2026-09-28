"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { isExactMatch, isCloseMatch } from "@/lib/content/text";
import type { ReviewCard } from "@/lib/review/types";
import type { ClozePayload, LocatePayload, QuestionPayload } from "@/lib/content/card-payloads";
import { QUESTION_KIND_LABELS } from "@/lib/content/card-payloads";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { VerseTrainer } from "@/components/verse/VerseTrainer";

interface Props {
  card: ReviewCard;
  revealed: boolean;
  onReveal: (wasCorrect: boolean | null) => void;
  /** Present this card as multiple choice with these options (decided per
   * session by src/lib/session/interleave.ts). */
  mcqOptions?: string[];
}

const LONG_ANSWER = 28;

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

  if (card.type === "verse" && !revealed) {
    return <VerseTrainer card={card} onDone={onReveal} />;
  }

  const accepted = [card.answer, ...card.answer_alt];
  const question = card.type === "question" ? (card.payload as QuestionPayload | null) : null;

  function submitText() {
    if (!textAnswer.trim()) return onReveal(null);
    if (isExactMatch(textAnswer, accepted)) return onReveal(true);
    if (accepted.some((a) => isCloseMatch(textAnswer, a))) {
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

  const asMcq = !!mcqOptions?.length;
  const isTextType = ["question", "recall", "chain", "cloze", "locate"].includes(card.type);
  // Long answers are unreasonable to force exact retyping of — reveal and
  // let the learner self-grade instead.
  const isLongAnswer = card.answer.length > LONG_ANSWER;
  const requiresTyping = isTextType && !isLongAnswer && !asMcq;
  const showReveal = !revealed && !requiresTyping && !asMcq;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-line bg-surface p-6 text-center">
        {(question || card.verse_ref) && (
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink-faint">
            {question ? QUESTION_KIND_LABELS[question.kind] : ""}
            {question && card.verse_ref ? " · " : ""}
            {card.verse_ref ?? ""}
          </p>
        )}
        <p className="text-lg text-ink leading-relaxed whitespace-pre-line">{card.prompt}</p>
      </div>

      {!revealed && asMcq && (
        <div className="grid grid-cols-1 gap-2">
          {mcqOptions!.map((opt) => (
            <Button key={opt} variant="secondary" onClick={() => pickOption(opt)} className="text-left">
              {opt}
            </Button>
          ))}
        </div>
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

      {showReveal && (
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
          {question?.why && <p className="mt-3 text-sm text-ink-muted leading-relaxed">{question.why}</p>}
          {card.verse_ref && card.type !== "question" && (
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
