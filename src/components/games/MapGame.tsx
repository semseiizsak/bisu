"use client";

import { useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useGameScore } from "@/lib/review/use-game-score";
import type { PersistedCardState } from "@/lib/fsrs/engine";

interface Item {
  name: string;
  svg_x: number;
  svg_y: number;
  tolerance: number;
  cardId: number | null;
  state: PersistedCardState | null;
}

const VIEWBOX = { w: 800, h: 600 };

export function MapGame({ items }: { items: Item[] }) {
  const [order] = useState(() => [...items].sort(() => Math.random() - 0.5));
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null);
  const [hit, setHit] = useState<boolean | null>(null);
  const { submit } = useGameScore("game:map");

  const item = order[index];

  async function handleClick(e: MouseEvent<SVGSVGElement>) {
    if (hit != null) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEWBOX.w;
    const y = ((e.clientY - rect.top) / rect.height) * VIEWBOX.h;
    setGuess({ x, y });
    const dist = Math.hypot(x - item.svg_x, y - item.svg_y);
    const correct = dist <= item.tolerance;
    setHit(correct);
    if (item.cardId && item.state) {
      await submit(item.cardId, item.state, correct ? 3 : 1);
    }
  }

  function next() {
    setGuess(null);
    setHit(null);
    setIndex((i) => i + 1);
  }

  if (!item) {
    return (
      <div className="mt-8 text-center">
        <p className="text-2xl font-extrabold text-ink">Kész!</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-ink-faint">
        {index + 1} / {order.length}
      </p>
      <p className="mt-1 text-lg font-extrabold text-ink">Mutasd meg: {item.name}</p>

      <svg
        viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
        onClick={handleClick}
        className="mt-3 w-full cursor-crosshair rounded-lg border border-line bg-surface"
        role="img"
        aria-label="Bibliai Közel-Kelet vaktérkép"
      >
        <rect x="0" y="0" width={VIEWBOX.w} height={VIEWBOX.h} fill="var(--color-surface)" />
        <path
          d="M100 250 Q 300 150 500 220 T 750 300 Q 600 450 400 480 T 120 400 Z"
          fill="none"
          stroke="var(--color-line-strong)"
          strokeWidth="1.5"
        />
        {guess && (
          <circle cx={guess.x} cy={guess.y} r="8" fill={hit ? "var(--color-good)" : "var(--color-bad)"} opacity="0.8" />
        )}
        {hit != null && <circle cx={item.svg_x} cy={item.svg_y} r="6" fill="var(--color-accent)" />}
      </svg>

      {hit != null && (
        <div className="mt-3 flex items-center justify-between">
          <p className={hit ? "font-extrabold text-good" : "font-extrabold text-bad"}>{hit ? "Talált!" : "Mellé."}</p>
          <Button size="sm" onClick={next}>
            Következő
          </Button>
        </div>
      )}
    </div>
  );
}
