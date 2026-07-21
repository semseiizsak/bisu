"use client";

import { useState } from "react";
import { VerseTrainer } from "@/components/verse/VerseTrainer";
import { ButtonLink } from "@/components/ui/Button";
import type { ReviewCard } from "@/lib/review/types";

/** Standalone deliberate-practice wrapper around VerseTrainer for /memoriter —
 * unlike the daily quiz it never writes an FSRS review, it just lets the
 * stage-advance side effect inside VerseTrainer run and shows a result screen. */
export function PracticeVerse({ card }: { card: ReviewCard }) {
  const [result, setResult] = useState<{ ok: boolean | null } | null>(null);

  if (result) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="text-2xl font-extrabold text-ink">{result.ok ? "Hibátlan!" : "Kész — gyakorold még egyszer."}</p>
        <ButtonLink href="/memoriter" size="lg">
          Vissza a memoriterekhez
        </ButtonLink>
      </div>
    );
  }

  return <VerseTrainer card={card} onDone={(ok) => setResult({ ok })} />;
}
