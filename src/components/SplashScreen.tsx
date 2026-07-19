"use client";

import { useEffect, useState } from "react";

/**
 * Boot splash. Three-layer loading concept:
 * 1. the OS shows a pixel-identical launch image (public/splash/*) the
 *    instant the icon is tapped — no network needed;
 * 2. this component is server-rendered into the first HTML flush and its
 *    glyph pulse + indeterminate progress bar are pure CSS keyframes, so
 *    the screen is visibly alive even before any JavaScript arrives;
 * 3. once the client hydrates (app interactive) it fades out.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 100);
    const removeTimer = setTimeout(() => setVisible(false), 100 + 300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-paper pb-[12vh] transition-opacity duration-300 ease-[var(--ease-standard)]"
      style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? "none" : "auto" }}
    >
      <svg
        width="120"
        height="120"
        viewBox="0 0 100 100"
        style={{ animation: "splash-pulse 1.6s var(--ease-standard) infinite" }}
      >
        <rect x="17" y="15" width="66" height="70" rx="7" fill="var(--color-ink)" />
        <polygon points="30.2,15 41.42,15 41.42,47.2 35.81,40.2 30.2,47.2" fill="var(--color-paper)" />
      </svg>
      <p className="mt-4 text-sm font-extrabold tracking-wide text-ink-muted">Biblia Mastery</p>
      <div className="mt-6 h-1 w-24 overflow-hidden rounded-full bg-line">
        <div
          className="h-full w-2/5 rounded-full bg-accent"
          style={{ animation: "splash-bar 1.1s var(--ease-standard) infinite" }}
        />
      </div>
    </div>
  );
}
