"use client";

import { useMemo } from "react";

const COLORS = ["var(--color-accent)", "var(--color-gold)", "var(--color-good)", "var(--color-sky)", "var(--color-violet)"];

/** One-shot CSS confetti burst; render it inside a `relative` container. */
export function Confetti({ count = 28 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 90 + ((i * 37) % 80);
        return {
          dx: `${Math.cos(angle) * dist}px`,
          dy: `${Math.abs(Math.sin(angle)) * dist + 120}px`,
          rot: `${((i * 97) % 720) - 360}deg`,
          delay: `${(i % 6) * 40}ms`,
          dur: `${1300 + ((i * 53) % 700)}ms`,
          color: COLORS[i % COLORS.length],
          round: i % 3 === 0,
        };
      }),
    [count],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              "--dx": p.dx,
              "--dy": p.dy,
              "--rot": p.rot,
              "--delay": p.delay,
              "--dur": p.dur,
              background: p.color,
              borderRadius: p.round ? "999px" : undefined,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
