import Link from "next/link";
import { cx } from "@/lib/cx";

export type StepState = "done" | "current" | "todo";

export interface PathStep {
  key: string;
  emoji: string;
  title: string;
  desc: string;
  state: StepState;
  href: string;
  /** Minutes left; shown on the right for steps that aren't done. */
  minutes?: number;
  /** Progress text such as "4/12" for a half-done step. */
  progress?: string;
  tone: "sky" | "accent" | "violet";
}

const TONE = {
  sky: { bg: "bg-sky", deep: "var(--color-sky-deep)", ring: "var(--color-sky)" },
  accent: { bg: "bg-accent", deep: "var(--color-accent-deep)", ring: "var(--color-accent)" },
  violet: { bg: "bg-violet", deep: "var(--color-violet-deep)", ring: "var(--color-violet)" },
} as const;

/** The day as a three-stop path: read → quiz → play. */
export function DayPath({ steps }: { steps: PathStep[] }) {
  return (
    <ol className="mt-6 flex flex-col">
      {steps.map((s, i) => {
        const tone = TONE[s.tone];
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="relative flex items-stretch gap-4">
            <div className="flex w-16 shrink-0 flex-col items-center">
              <div className="relative">
                {s.state === "current" && (
                  <span
                    aria-hidden
                    className="pulse-ring absolute inset-0 rounded-full"
                    style={{ "--ring-color": tone.ring } as React.CSSProperties}
                  />
                )}
                <Link
                  href={s.href}
                  aria-label={s.title}
                  style={
                    {
                      boxShadow: `0 4px 0 0 ${s.state === "done" ? "var(--color-gold-deep)" : s.state === "current" ? tone.deep : "var(--color-line-strong)"}`,
                      "--press-color": s.state === "done" ? "var(--color-gold-deep)" : s.state === "current" ? tone.deep : "var(--color-line-strong)",
                    } as React.CSSProperties
                  }
                  className={cx(
                    "tap-target press relative flex h-16 w-16 items-center justify-center rounded-full text-3xl",
                    s.state === "done" && "bg-gold text-ink",
                    s.state === "current" && tone.bg,
                    s.state === "todo" && "bg-line grayscale opacity-70",
                  )}
                >
                  {s.state === "done" ? "✓" : s.emoji}
                </Link>
              </div>
              {!last && (
                <div
                  className={cx("my-1 w-1.5 flex-1 rounded-full", s.state === "done" ? "bg-gold" : "bg-line")}
                  style={{ minHeight: 20 }}
                />
              )}
            </div>
            <Link
              href={s.href}
              className={cx("tap-target flex flex-1 items-center justify-between gap-3 pb-5 pt-2", s.state === "todo" && "opacity-70")}
            >
              <div className="min-w-0">
                <p className="text-lg font-black leading-tight text-ink">{s.title}</p>
                <p className="truncate text-sm font-semibold text-ink-muted">{s.desc}</p>
              </div>
              <span
                className={cx(
                  "shrink-0 rounded-xl px-2.5 py-1 text-xs font-black",
                  s.state === "done" && "bg-good/15 text-good",
                  s.state === "current" && "bg-ink/6 text-ink",
                  s.state === "todo" && "bg-line text-ink-faint",
                )}
              >
                {s.state === "done" ? "Kész" : (s.progress ?? (s.minutes != null ? `${s.minutes} perc` : ""))}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
