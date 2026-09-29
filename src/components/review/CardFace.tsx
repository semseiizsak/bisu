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
import { XP } from "@/lib/xp/constants";

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
  const [result, setResult] = useState<boolean | null>(null);
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    setTextAnswer("");
    setNearMiss(false);
    setSelectedOption(null);
    setResult(null);
    setShowContext(false);
  }, [card.id]);

  if (card.type === "verse" && !revealed) {
    return <VerseTrainer card={card} onDone={onReveal} />;
  }

  const accepted = [card.answer, ...card.answer_alt];
  const question = card.type === "question" ? (card.payload as QuestionPayload | null) : null;

  function reveal(correct: boolean | null) {
    setResult(correct);
    onReveal(correct);
  }

  function submitText() {
    if (!textAnswer.trim()) return reveal(null);
    if (isExactMatch(textAnswer, accepted)) return reveal(true);
    if (accepted.some((a) => isCloseMatch(textAnswer, a))) {
      setNearMiss(true);
      return;
    }
    reveal(false);
  }

  function confirmNearMiss(accept: boolean) {
    setNearMiss(false);
    reveal(accept);
  }

  function pickOption(option: string) {
    setSelectedOption(option);
    reveal(option === card.answer);
  }

  const asMcq = !!mcqOptions?.length;
  const isTextType = ["question", "recall", "chain", "cloze", "locate"].includes(card.type);
  // Long answers are unreasonable to force exact retyping of — reveal and
  // let the learner self-grade instead.
  const isLongAnswer = card.answer.length > LONG_ANSWER;
  const requiresTyping = isTextType && !isLongAnswer && !asMcq;
  const showReveal = !revealed && !requiresTyping && !asMcq;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border-2 border-line bg-surface p-6 text-center">
        {(question || card.verse_ref) && (
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-ink-faint">
            {question ? QUESTION_KIND_LABELS[question.kind] : ""}
            {question && card.verse_ref ? " · " : ""}
            {card.verse_ref ?? ""}
          </p>
        )}
        <p className="whitespace-pre-line text-lg font-bold leading-relaxed text-ink">{card.prompt}</p>
      </div>

      {asMcq && (
        <div className="grid grid-cols-1 gap-2">
          {mcqOptions!.map((opt) => {
            const isAnswer = revealed && opt === card.answer;
            const isWrongPick = revealed && selectedOption === opt && opt !== card.answer;
            return (
              <button
                key={opt}
                disabled={revealed}
                onClick={() => pickOption(opt)}
                className={cx(
                  "tap-target press rounded-2xl border-2 px-4 py-3 text-left font-bold transition-colors disabled:pointer-events-none",
                  !revealed && "border-line-strong bg-surface text-ink shadow-[0_4px_0_0_var(--color-line-strong)]",
                  isAnswer && "border-good bg-good/15 text-ink shadow-[0_4px_0_0_var(--color-good-deep)]",
                  isWrongPick && "border-bad bg-bad/15 text-ink shadow-[0_4px_0_0_var(--color-bad-deep)]",
                  revealed && !isAnswer && !isWrongPick && "border-line bg-surface text-ink-faint opacity-60",
                )}
              >
                {isAnswer ? "✅ " : isWrongPick ? "❌ " : ""}
                {opt}
              </button>
            );
          })}
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
        <div className="rounded-2xl border-2 border-gold/50 bg-gold/15 p-4">
          <p className="font-bold text-ink">
            🤔 Ezt gondoltad? <strong className="font-black">{card.answer}</strong>
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="good" onClick={() => confirmNearMiss(true)}>
              Igen, ezt
            </Button>
            <Button size="sm" variant="secondary" onClick={() => confirmNearMiss(false)}>
              Mégsem
            </Button>
          </div>
        </div>
      )}

      {showReveal && (
        <Button variant="secondary" size="lg" onClick={() => reveal(null)}>
          Mutasd a választ
        </Button>
      )}

      {revealed && (
        <div
          className={cx(
            "pop-in rounded-2xl border-2 p-4",
            result === true && "border-good/40 bg-good/12",
            result === false && "border-bad/40 bg-bad/10",
            result === null && "border-line bg-surface",
          )}
        >
          <p className={cx("text-sm font-black", result === true ? "text-good" : result === false ? "text-bad" : "text-ink-muted")}>
            {result === true ? `Helyes! +${XP.CORRECT_CARD} XP` : result === false ? "Nem talált" : "A válasz"}
          </p>
          {!asMcq && <p className="mt-1 text-lg font-black text-ink">{card.answer}</p>}
          {question?.why && <p className="mt-2 text-sm font-semibold leading-relaxed text-ink-muted">{question.why}</p>}
          {card.verse_ref && card.type !== "question" && (
            <button onClick={() => setShowContext((s) => !s)} className="mt-3 text-sm font-black text-accent underline underline-offset-4">
              {showContext ? "Kontextus elrejtése" : "Kontextus megnyitása"}
            </button>
          )}
          {showContext && (
            <p className="mt-2 rounded-xl border border-line bg-paper p-3 font-serif text-ink">
              {(card.payload as ClozePayload)?.full_verse ?? (card.payload as LocatePayload)?.verse_text ?? card.verse_ref}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
