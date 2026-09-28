import { Card } from "@/components/ui/Card";
import type { ReviewCard } from "@/lib/review/types";
import { QUESTION_KIND_LABELS, type QuestionPayload } from "@/lib/content/card-payloads";

/** Q&A study-sheet rendering of quiz cards — answers and explanations
 * visible. Used by the chapter notes page and the practice screens. */
export function NotesList({ cards, startIndex = 0 }: { cards: ReviewCard[]; startIndex?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {cards.map((c, i) => {
        const q = c.type === "question" ? (c.payload as QuestionPayload | null) : null;
        return (
          <Card key={c.id} className="p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">
              {startIndex + i + 1}.{q ? ` ${QUESTION_KIND_LABELS[q.kind]}` : ""} {c.verse_ref ? `· ${c.verse_ref}` : ""}
            </p>
            <p className="mt-1 text-ink">{c.prompt}</p>
            <p className="mt-2 text-lg font-extrabold text-accent">{c.answer}</p>
            {q?.why && <p className="mt-1.5 text-sm text-ink-muted leading-relaxed">{q.why}</p>}
          </Card>
        );
      })}
    </div>
  );
}
