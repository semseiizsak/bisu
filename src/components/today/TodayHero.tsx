import { cx } from "@/lib/cx";
import { xpToNextLevel } from "@/lib/xp/constants";

interface Props {
  dayIdx: number;
  streak: number;
  totalXp: number;
  todayXp: number;
  subtitle: string;
}

/** Day number, streak flame and the level bar — the only "stats" on the Today tab. */
export function TodayHero({ dayIdx, streak, totalXp, todayXp, subtitle }: Props) {
  const { current, next, level } = xpToNextLevel(totalXp);
  const pct = next > current ? Math.round(((totalXp - current) / (next - current)) * 100) : 100;

  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink-muted">{subtitle}</p>
          <h1 className="text-4xl font-black leading-none text-ink">{dayIdx}. nap</h1>
        </div>
        <div
          className={cx(
            "flex items-center gap-1.5 rounded-2xl border-2 px-3 py-2 text-lg font-black",
            streak > 0 ? "border-gold/40 bg-gold/15 text-ink" : "border-line bg-surface text-ink-faint",
          )}
          title={streak > 0 ? `${streak} napos sorozat` : "Még nincs sorozat"}
        >
          <span className={cx("text-2xl", streak > 0 && "wiggle inline-block")}>🔥</span>
          {streak}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet text-lg font-black text-white shadow-[0_3px_0_0_var(--color-violet-deep)]">
          {level}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="text-ink-muted">Szint {level}</span>
            <span className="text-ink-faint">
              {todayXp > 0 && <span className="mr-2 text-good">+{todayXp} ma</span>}
              {totalXp - current}/{next - current} XP
            </span>
          </div>
          <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-violet transition-[width] duration-500 ease-[var(--ease-standard)]"
              style={{ width: `${Math.max(3, pct)}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
