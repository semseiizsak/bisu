import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GAMES, type GameTone } from "@/lib/content/games";
import { availableGames, pickGame } from "@/lib/games/availability";
import { currentDayIndex } from "@/lib/session/current-day";
import { cx } from "@/lib/cx";

const TONE: Record<GameTone, string> = {
  sky: "bg-sky/12 border-sky/30",
  gold: "bg-gold/18 border-gold/40",
  accent: "bg-accent/12 border-accent/30",
  good: "bg-good/12 border-good/30",
  violet: "bg-violet/12 border-violet/30",
};

export default async function GamesPage() {
  const supabase = await createClient();
  const [dayIdx, available] = await Promise.all([currentDayIndex(supabase), availableGames(supabase)]);
  const today = pickGame(dayIdx, available);

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <h1 className="text-2xl font-black text-ink">Játékok</h1>
      <p className="mt-1 text-sm font-bold text-ink-muted">Minden játék XP-t ér. A mai ajánlott a csillagos.</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {GAMES.map((g) => {
          const ready = available.has(g.slug);
          const isToday = g.slug === today;
          const inner = (
            <>
              {isToday && (
                <span className="absolute -right-2 -top-2 rounded-full bg-gold px-2 py-0.5 text-[11px] font-black text-ink shadow-[0_2px_0_0_var(--color-gold-deep)]">
                  ⭐ Ma
                </span>
              )}
              <span className="text-4xl">{g.emoji}</span>
              <p className="mt-2 font-black leading-tight text-ink">{g.name}</p>
              <p className="mt-0.5 text-xs font-semibold text-ink-muted">{ready ? g.desc : "Hamarosan — kell még tartalom"}</p>
            </>
          );
          const classes = cx(
            "relative flex min-h-[132px] flex-col rounded-3xl border-2 p-4",
            TONE[g.tone],
            ready ? "tap-target press shadow-[0_4px_0_0_var(--color-line-strong)]" : "opacity-50 grayscale",
          );
          return ready ? (
            <Link key={g.slug} href={`/jatekok/${g.slug}`} className={classes}>
              {inner}
            </Link>
          ) : (
            <div key={g.slug} className={classes}>
              {inner}
            </div>
          );
        })}
      </div>
    </main>
  );
}
