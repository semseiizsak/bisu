import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildSessionPlan } from "@/lib/session/build-session";
import { loadReviewCards } from "@/lib/review/load-cards";
import { SessionRunner } from "@/components/review/SessionRunner";
import type { SessionMode } from "@/lib/session/types";

export default async function SessionPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: modeParam } = await searchParams;
  const mode: SessionMode = modeParam === "short" ? "short" : "full";

  const supabase = await createClient();
  const plan = await buildSessionPlan(supabase, new Date(), mode);

  const cardIds = plan.blocks
    .filter((b) => ["review", "new", "weak", "interleave"].includes(b.type))
    .flatMap((b) => b.items.map((i) => i.card_id));

  const cards = await loadReviewCards(supabase, cardIds);
  const game = plan.blocks.find((b) => b.type === "game")?.game?.game ?? null;

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <Link href="/ma" className="text-sm font-extrabold text-ink-muted">
        ← Vissza
      </Link>
      <div className="mt-4">
        <SessionRunner cards={cards} game={game} />
      </div>
    </main>
  );
}
