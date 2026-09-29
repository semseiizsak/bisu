import { cx } from "@/lib/cx";
import type { FsrsRating } from "@/lib/fsrs/engine";

const RATINGS: { rating: FsrsRating; label: string; emoji: string; className: string }[] = [
  { rating: 1, label: "Újra", emoji: "😵", className: "bg-bad text-white shadow-[0_4px_0_0_var(--color-bad-deep)] [--press-color:var(--color-bad-deep)]" },
  { rating: 2, label: "Nehéz", emoji: "😅", className: "bg-warn text-ink shadow-[0_4px_0_0_var(--color-gold-deep)] [--press-color:var(--color-gold-deep)]" },
  { rating: 3, label: "Jó", emoji: "🙂", className: "bg-good text-white shadow-[0_4px_0_0_var(--color-good-deep)] [--press-color:var(--color-good-deep)]" },
  { rating: 4, label: "Könnyű", emoji: "😎", className: "bg-sky text-white shadow-[0_4px_0_0_var(--color-sky-deep)] [--press-color:var(--color-sky-deep)]" },
];

export function RatingButtons({ onRate, suggested }: { onRate: (r: FsrsRating) => void; suggested?: FsrsRating }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map((r) => (
        <button
          key={r.rating}
          onClick={() => onRate(r.rating)}
          className={cx(
            "tap-target press flex flex-col items-center gap-0.5 rounded-2xl py-2.5 font-black",
            r.className,
            suggested === r.rating ? "scale-[1.04] ring-2 ring-ink/70 ring-offset-2 ring-offset-paper" : "opacity-85",
          )}
        >
          <span className="text-xl">{r.emoji}</span>
          <span className="text-sm">{r.label}</span>
        </button>
      ))}
    </div>
  );
}
