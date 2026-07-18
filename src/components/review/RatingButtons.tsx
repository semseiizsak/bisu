import { cx } from "@/lib/cx";
import type { FsrsRating } from "@/lib/fsrs/engine";

const RATINGS: { rating: FsrsRating; label: string; keyHint: string; className: string }[] = [
  { rating: 1, label: "Újra", keyHint: "1", className: "bg-bad text-paper" },
  { rating: 2, label: "Nehéz", keyHint: "2", className: "bg-warn text-paper" },
  { rating: 3, label: "Jó", keyHint: "3", className: "bg-good text-paper" },
  { rating: 4, label: "Könnyű", keyHint: "4", className: "bg-ink text-paper" },
];

export function RatingButtons({ onRate, suggested }: { onRate: (r: FsrsRating) => void; suggested?: FsrsRating }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map((r) => (
        <button
          key={r.rating}
          onClick={() => onRate(r.rating)}
          className={cx(
            "tap-target flex flex-col items-center gap-1 rounded-md py-3 font-extrabold transition-transform duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
            r.className,
            suggested === r.rating && "ring-2 ring-offset-2 ring-ink ring-offset-paper scale-[1.03]",
          )}
        >
          <span>{r.label}</span>
          <span className="text-xs font-medium opacity-70">{r.keyHint}</span>
        </button>
      ))}
    </div>
  );
}
