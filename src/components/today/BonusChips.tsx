import { cx } from "@/lib/cx";

interface QuestRow {
  quest_key: string;
  label_hu: string;
  progress: number;
  target: number;
  xp: number;
  completed_at: string | null;
}

/** Daily quests as one compact strip — bonus XP, not another checklist. */
export function BonusChips({ quests }: { quests: QuestRow[] }) {
  if (quests.length === 0) return null;
  return (
    <section className="mt-2">
      <p className="text-xs font-black uppercase tracking-wide text-ink-faint">Bónusz</p>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {quests.map((q) => {
          const done = !!q.completed_at;
          const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
          return (
            <li
              key={q.quest_key}
              className={cx(
                "relative flex items-center gap-2 overflow-hidden rounded-xl px-3 py-2 text-sm",
                done ? "bg-good/12" : "bg-surface border-2 border-line",
              )}
            >
              {!done && <span className="absolute inset-y-0 left-0 bg-gold/20" style={{ width: `${pct}%` }} />}
              <span className="relative text-base">{done ? "✅" : "⭐"}</span>
              <span className={cx("relative min-w-0 flex-1 truncate font-bold", done ? "text-good" : "text-ink")}>{q.label_hu}</span>
              <span className={cx("relative shrink-0 text-xs font-black", done ? "text-good" : "text-ink-faint")}>
                {done ? `+${q.xp}` : q.target > 1 ? `${Math.min(q.progress, q.target)}/${q.target} · +${q.xp}` : `+${q.xp}`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
