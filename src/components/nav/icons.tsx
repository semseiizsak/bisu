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
