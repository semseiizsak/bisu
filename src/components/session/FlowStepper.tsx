import Link from "next/link";
import { cx } from "@/lib/cx";

const STAGES = [
  { label: "Olvasás", emoji: "📖" },
  { label: "Jegyzetek", emoji: "📝" },
  { label: "Kvíz", emoji: "🧠" },
  { label: "Kész", emoji: "🏆" },
] as const;

interface Props {
  stage: 1 | 2 | 3 | 4;
  /** Extra context under the chips, e.g. "fejezet 2/4" or "2. kör". */
  detail?: string;
}

/** Compact header for the guided daily session — always shows which stage
 * of the day the user is in, with a single exit point back to /ma. */
export function FlowStepper({ stage, detail }: Props) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <Link href="/ma" className="tap-target flex h-9 w-9 items-center justify-center rounded-full bg-line text-sm font-black text-ink-muted" aria-label="Kilépés">
          ✕
        </Link>
        <div className="flex items-center gap-1.5">
          {STAGES.map((s, i) => {
            const idx = (i + 1) as 1 | 2 | 3 | 4;
            const isCurrent = idx === stage;
            const isDone = idx < stage;
            return (
              <span
                key={s.label}
                className={cx(
                  "flex h-8 items-center justify-center rounded-full text-sm",
                  isCurrent && "gap-1 bg-accent px-3 font-black text-accent-ink",
                  isDone && "w-8 bg-gold/30",
                  !isCurrent && !isDone && "w-8 bg-line opacity-60",
                )}
              >
                {isDone ? "✓" : s.emoji}
                {isCurrent && <span>{s.label}</span>}
              </span>
            );
          })}
        </div>
      </div>
      {detail && <p className="mt-2 text-right text-sm font-bold text-ink-muted">{detail}</p>}
    </div>
  );
}
