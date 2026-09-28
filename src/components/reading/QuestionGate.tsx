"use client";

import { useState, useTransition } from "react";
import { cx } from "@/lib/cx";
import { setQuestionKept } from "@/lib/actions/questions";
import { Card } from "@/components/ui/Card";
import { QUESTION_KIND_LABELS, type QuestionKind, type QuestionPayload } from "@/lib/content/card-payloads";
import type { ReviewCard } from "@/lib/review/types";

/**
 * The keep / skip gate shown right after a chapter is read. Everything is
 * visible (question, answer, why) — this is a study sheet, not a test — and
 * a bad question can be dropped before it ever reaches the quiz. The old app
 * only let you flag a card after it had already annoyed you mid-session.
 */
export function QuestionGate({ cards, initiallySkipped = [] }: { cards: ReviewCard[]; initiallySkipped?: number[] }) {
  const [skipped, setSkipped] = useState<Set<number>>(new Set(initiallySkipped));
  const [pending, startTransition] = useTransition();

  function toggle(card: ReviewCard) {
    const willSkip = !skipped.has(card.id);
    setSkipped((prev) => {
      const next = new Set(prev);
      if (willSkip) next.add(card.id);
      else next.delete(card.id);
      return next;
    });
    startTransition(async () => {
      try {
        await setQuestionKept(card.id, !willSkip);
      } catch {
        // revert on failure — the server is the source of truth
        setSkipped((prev) => {
          const next = new Set(prev);
          if (willSkip) next.delete(card.id);
          else next.add(card.id);
          return next;
        });
      }
    });
  }

  if (cards.length === 0) return null;

  const keptCount = cards.length - skipped.size;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">Kérdések a kvízhez</h2>
        <p className={cx("text-xs", pending ? "text-ink-faint" : "text-ink-muted")}>
          {keptCount}/{cards.length} marad
        </p>
      </div>
      <p className="mt-1 text-sm text-ink-muted">Ami nem érdekes, azt tedd félre — csak a megtartottak kerülnek a kvízbe.</p>

      <div className="mt-3 flex flex-col gap-3">
        {cards.map((c, i) => {
          const isSkipped = skipped.has(c.id);
          const payload = c.type === "question" ? (c.payload as QuestionPayload | null) : null;
          const kind = payload?.kind as QuestionKind | undefined;
          return (
            <Card key={c.id} className={cx("p-4 transition-opacity", isSkipped && "opacity-45")}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">
                  {i + 1}. {kind ? QUESTION_KIND_LABELS[kind] : c.type === "recall" ? "Saját" : ""}
                  {c.verse_ref ? ` · ${c.verse_ref}` : ""}
                </p>
                <button
                  onClick={() => toggle(c)}
                  className={cx(
                    "tap-target shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold",
                    isSkipped ? "bg-line text-ink-muted" : "bg-good/15 text-good",
                  )}
                  aria-pressed={!isSkipped}
                >
                  {isSkipped ? "Visszateszem" : "Megtartom ✓"}
                </button>
              </div>
              <p className={cx("mt-1 text-ink", isSkipped && "line-through decoration-ink-faint")}>{c.prompt}</p>
              <p className="mt-2 text-lg font-extrabold text-accent">{c.answer}</p>
              {payload?.why && <p className="mt-1.5 text-sm text-ink-muted leading-relaxed">{payload.why}</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
