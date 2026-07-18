import type { SVGProps } from "react";

const common: SVGProps<SVGSVGElement> = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function TodayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 8v4l2.6 2.6" />
    </svg>
  );
}

export function ReadingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M4 5.5C4 4.67 4.67 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
      <path d="M20 5.5c0-.83-.67-1.5-1.5-1.5H12v16h6.5c.83 0 1.5-.67 1.5-1.5v-13Z" />
    </svg>
  );
}

export function GamesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <rect x="3.5" y="7.5" width="17" height="10" rx="4" />
      <path d="M8 10.5v3M6.5 12h3" />
      <circle cx="15.25" cy="10.75" r=".9" fill="currentColor" stroke="none" />
      <circle cx="17.25" cy="13.25" r=".9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ProgressIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M5 19V10M12 19V5M19 19v-6" />
    </svg>
  );
}

export function StreakIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...common} {...props}>
      <path d="M12 3c.6 2.4-1.8 3.6-2.6 5.4C8.3 10.5 9 12.4 10.5 13c-.3-1.3.3-2 .9-2.5.2 1 .9 1.6 1.8 2.2 1.1.7 1.8 1.8 1.8 3.1 0 2.6-2.1 4.7-4.7 4.7S5.6 18.4 5.6 15.8c0-4.4 4.2-6.6 6.4-12.8Z" />
    </svg>
  );
}
