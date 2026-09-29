import { cx } from "@/lib/cx";
import type { BadgeMetrics } from "@/lib/badges/check";

interface BadgeRow {
  id: string;
  category: string;
  metric: string;
  threshold: number;
  label_hu: string;
  description_hu: string;
  earned_at: string | null;
}

export function badgeEmoji(b: { category: string; id: string }): string {
  if (b.category === "streak") return "🔥";
  if (b.category === "boss") return "👑";
  if (b.category === "volume") return "🔁";
  if (b.id.startsWith("coverage")) return "🗺️";
  return "📚";
}

function progressLabel(b: BadgeRow, value: number): string {
  if (b.metric === "coverage") return `${Math.round(value * 100)}% / ${Math.round(b.threshold * 100)}%`;
  return `${Math.min(Math.floor(value), b.threshold)} / ${b.threshold}`;
}

/** Medals: earned ones glow gold, locked ones show how far along they are. */
export function BadgeGrid({ badges, metrics }: { badges: BadgeRow[]; metrics: BadgeMetrics }) {
  const earnedCount = badges.filter((b) => b.earned_at).length;
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-black text-ink">Jelvények</h2>
        <span className="text-sm font-extrabold text-ink-faint">
          {earnedCount}/{badges.length}
        </span>
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-x-2 gap-y-5">
        {badges.map((b) => {
          const earned = !!b.earned_at;
          const value = metrics[b.metric] ?? 0;
          const pct = earned ? 1 : Math.max(0, Math.min(1, value / b.threshold));
          const r = 34;
          const c = 2 * Math.PI * r;
          return (
            <li key={b.id} className="flex flex-col items-center text-center" title={b.description_hu}>
              <div className="relative h-[76px] w-[76px]">
                <svg viewBox="0 0 76 76" className="absolute inset-0 -rotate-90">
                  <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-line)" strokeWidth="4" />
                  {!earned && pct > 0 && (
                    <circle
                      cx="38"
                      cy="38"
                      r={r}
                      fill="none"
                      stroke="var(--color-gold)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={c}
                      strokeDashoffset={c * (1 - pct)}
                    />
                  )}
                </svg>
                <div
                  className={cx(
                    "absolute inset-[7px] flex items-center justify-center rounded-full text-3xl",
                    earned
                      ? "shine bg-gold shadow-[0_4px_0_0_var(--color-gold-deep)]"
                      : "bg-line grayscale opacity-60",
                  )}
                >
                  {badgeEmoji(b)}
                </div>
                {earned && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-good text-xs font-black text-white shadow">
                    ✓
                  </span>
                )}
              </div>
              <p className={cx("mt-2 text-xs font-black leading-tight", earned ? "text-ink" : "text-ink-muted")}>{b.label_hu}</p>
              {!earned && <p className="mt-0.5 text-[11px] font-bold text-ink-faint">{progressLabel(b, value)}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
