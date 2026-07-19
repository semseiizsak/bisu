import Link from "next/link";
import { cx } from "@/lib/cx";

const STAGES = ["Olvasás", "Jegyzetek", "Ismétlés", "Kész"] as const;

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
        <Link href="/ma" className="text-sm font-extrabold text-ink-muted">
          ← Kilépés
        </Link>
        <div className="flex items-center gap-1.5">
          {STAGES.map((label, i) => {
            const idx = (i + 1) as 1 | 2 | 3 | 4;
            const isCurrent = idx === stage;
            const isDone = idx < stage;
            return (
              <span
                key={label}
                className={cx(
                  "rounded-full px-2.5 py-1 text-xs",
                  isCurrent && "bg-accent font-extrabold text-accent-ink",
                  isDone && "bg-line font-extrabold text-ink-muted",
                  !isCurrent && !isDone && "text-ink-faint",
                )}
              >
                {idx}
                {isCurrent && <span className="ml-1">{label}</span>}
              </span>
            );
          })}
        </div>
      </div>
      {detail && <p className="mt-2 text-right text-sm text-ink-muted">{detail}</p>}
    </div>
  );
}
