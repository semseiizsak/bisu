import { cx } from "@/lib/cx";

interface QuestRow {
  quest_key: string;
  label_hu: string;
  progress: number;
  target: number;
  xp: number;
  completed_at: string | null;
}

export function QuestList({ quests }: { quests: QuestRow[] }) {
  if (quests.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">Napi küldetések</h2>
      <div className="mt-2 flex flex-col gap-2">
        {quests.map((q) => {
          const done = !!q.completed_at;
          const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
          return (
            <div key={q.quest_key} className={cx("rounded-md border border-line bg-surface p-3", done && "opacity-60")}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-extrabold text-ink">{q.label_hu}</p>
                <span className={cx("shrink-0 text-xs font-extrabold", done ? "text-good" : "text-ink-faint")}>
                  {done ? "Kész" : `+${q.xp} XP`}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div
                  className={cx(
                    "h-full rounded-full transition-[width] duration-[var(--dur-standard)] ease-[var(--ease-standard)]",
                    done ? "bg-good" : "bg-accent",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
