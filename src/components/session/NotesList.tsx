import { Card } from "@/components/ui/Card";
import type { ReviewCard } from "@/lib/review/types";
import type { McqPayload } from "@/lib/content/card-payloads";

/** Q&A study notes rendering of quiz cards — answers visible, MCQ options
 * shown as context chips. Used by the per-chapter notes page and the daily
 * session's aggregated Jegyzetek stage. */
export function NotesList({ cards, startIndex = 0 }: { cards: ReviewCard[]; startIndex?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {cards.map((c, i) => {
        const options = c.type === "mcq" ? ((c.payload as McqPayload | null)?.options ?? []) : [];
        return (
          <Card key={c.id} className="p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">
              {startIndex + i + 1}. {c.verse_ref ?? ""}
            </p>
            <p className="mt-1 text-ink">{c.prompt}</p>
            <p className="mt-2 text-lg font-extrabold text-accent">{c.answer}</p>
            {options.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from(new Set(options)).map((opt) => (
                  <span
                    key={opt}
                    className={
                      opt === c.answer
                        ? "rounded-full bg-good/70 px-2.5 py-1 text-xs font-extrabold text-paper"
                        : "rounded-full bg-line px-2.5 py-1 text-xs text-ink-faint"
                    }
                  >
                    {opt}
                  </span>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
