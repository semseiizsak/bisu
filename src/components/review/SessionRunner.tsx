"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReviewSession } from "@/components/review/ReviewSession";
import { flushPendingReviews } from "@/lib/db/sync";
import { ButtonLink } from "@/components/ui/Button";
import { gameLabel } from "@/lib/content/games";
import type { ReviewCard } from "@/lib/review/types";

export function SessionRunner({ cards, game = null }: { cards: ReviewCard[]; game?: string | null }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    void flushPendingReviews();
  }, []);

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="text-ink-muted">Nincs ma esedékes kártya.</p>
        {game && (
          <ButtonLink href={`/jatekok/${game}`}>Mai játék: {gameLabel(game)}</ButtonLink>
        )}
        <ButtonLink href="/ma" variant={game ? "ghost" : "primary"}>
          Vissza a mai naphoz
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <ReviewSession
        cards={cards}
        mode="srs"
        onComplete={() => {
          setDone(true);
          void flushPendingReviews();
        }}
      />
      {done && game && (
        <div className="mt-6 flex justify-center">
          <ButtonLink href={`/jatekok/${game}`}>Mai játék: {gameLabel(game)}</ButtonLink>
        </div>
      )}
      <div className="mt-6 flex justify-center">
        <Link href="/ma" className="text-sm font-extrabold text-ink-muted underline underline-offset-4">
          Vissza a mai naphoz
        </Link>
      </div>
    </div>
  );
}
