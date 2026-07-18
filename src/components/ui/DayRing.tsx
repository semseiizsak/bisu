interface Props {
  reading: number;
  srs: number;
  game: number;
  size?: number;
}

const RINGS = [
  { key: "reading", color: "var(--color-accent)" },
  { key: "srs", color: "var(--color-good)" },
  { key: "game", color: "var(--color-warn)" },
] as const;

export function DayRing({ reading, srs, game, size = 64 }: Props) {
  const values = { reading, srs, game };
  const strokeWidth = 5;
  const gap = 2;
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      {RINGS.map((ring, i) => {
        const r = center - strokeWidth / 2 - i * (strokeWidth + gap);
        const circumference = 2 * Math.PI * r;
        const value = Math.max(0, Math.min(1, values[ring.key]));
        const offset = circumference * (1 - value);
        return (
          <g key={ring.key}>
            <circle cx={center} cy={center} r={r} fill="none" stroke="var(--color-line)" strokeWidth={strokeWidth} />
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={ring.color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-[var(--dur-standard)] ease-[var(--ease-standard)]"
            />
          </g>
        );
      })}
    </svg>
  );
}
