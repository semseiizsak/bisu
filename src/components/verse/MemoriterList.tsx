"use client";

import { useState, useTransition } from "react";
import { cx } from "@/lib/cx";
import { removeMemoryVerse } from "@/lib/actions/memory-verse";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export interface MemoriterRow {
  card_id: number;
  reference: string;
  text: string;
  stage: number;
  due: boolean;
}

export function MemoriterList({ verses }: { verses: MemoriterRow[] }) {
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = verses.filter((v) => !removed.has(v.card_id));

  if (visible.length === 0) {
    return <p className="text-ink-muted">Még nincs memoriter. Jelölj ki egy verset olvasás közben, és válaszd a &bdquo;Megtanulom kívülről&rdquo; lehetőséget.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {visible.map((v) => (
        <Card key={v.card_id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-extrabold text-ink">{v.reference}</p>
              <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{v.text}</p>
            </div>
            <span
              className={cx(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold",
                v.due ? "bg-accent/20 text-accent" : "bg-line text-ink-faint",
              )}
            >
              {v.stage}/3
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ButtonLink href={`/memoriter/${v.card_id}`} size="sm" variant="secondary">
              Gyakorlom
            </ButtonLink>
            <button
              onClick={() =>
                startTransition(async () => {
                  await removeMemoryVerse(v.card_id);
                  setRemoved((s) => new Set(s).add(v.card_id));
                })
              }
              disabled={pending}
              className="text-xs text-ink-faint underline underline-offset-4 hover:text-ink-muted disabled:opacity-50"
            >
              Törlöm
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
