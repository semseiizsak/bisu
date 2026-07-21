import { createClient } from "@/lib/supabase/server";
import { buildSessionPlan } from "@/lib/session/build-session";
import { loadReviewCards } from "@/lib/review/load-cards";
import { computeStreak } from "@/lib/streak/compute";
import { DailySession } from "@/components/session/DailySession";
import { DAILY_QUIZ_CAP, SHORT_QUIZ_CAP } from "@/lib/session/constants";
import type { SessionMode } from "@/lib/session/types";

const QUIZ_BLOCKS = ["review", "new", "weak", "interleave"];

/** Caps the quiz while keeping every block represented — a plain slice would
 * let a big review block starve the new/weak cards out of the session. */
function capProportionally(blocks: { type: string; items: { card_id: number }[] }[], cap: number): number[] {
  const quizBlocks = blocks.filter((b) => QUIZ_BLOCKS.includes(b.type) && b.items.length > 0);
  const total = quizBlocks.reduce((s, b) => s + b.items.length, 0);
  if (total <= cap) return quizBlocks.flatMap((b) => b.items.map((i) => i.card_id));

  const exact = quizBlocks.map((b) => (b.items.length * cap) / total);
  const take = exact.map(Math.floor);
  let remainder = cap - take.reduce((s, n) => s + n, 0);
  const byFraction = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of byFraction) {
    if (remainder <= 0) break;
    take[i] += 1;
    remainder -= 1;
  }
  return quizBlocks.flatMap((b, i) => b.items.slice(0, take[i]).map((it) => it.card_id));
}

export default async function SessionPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: modeParam } = await searchParams;
  const mode: SessionMode = modeParam === "short" ? "short" : "full";

  const supabase = await createClient();
  const plan = await buildSessionPlan(supabase, new Date(), mode);

  const cap = mode === "short" ? SHORT_QUIZ_CAP : DAILY_QUIZ_CAP;
  const cardIds = capProportionally(plan.blocks, cap);

  const [cards, streak] = await Promise.all([loadReviewCards(supabase, cardIds), computeStreak(supabase)]);
  const game = plan.blocks.find((b) => b.type === "game")?.game?.game ?? null;

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <DailySession cards={cards} game={game} streak={streak.current} dayIdx={plan.day_idx} />
    </main>
  );
}
