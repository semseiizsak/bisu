"use client";

import { useEffect, useState } from "react";

/**
 * Server-rendered so it paints in the very first frame (no blank flash on
 * launch), then fades out once the client has hydrated. Mirrors the app
 * icon glyph so the splash and the home-screen icon feel like the same
 * object settling into place.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 120);
    const removeTimer = setTimeout(() => setVisible(false), 120 + 420);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-paper transition-opacity duration-[420ms] ease-[var(--ease-standard)]"
      style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? "none" : "auto" }}
    >
      <svg
        width="72"
        height="72"
        viewBox="0 0 100 100"
        className="transition-transform duration-[420ms] ease-[var(--ease-standard)]"
        style={{ transform: fading ? "scale(0.94)" : "scale(1)" }}
      >
        <rect x="17" y="15" width="66" height="70" rx="7" fill="var(--color-ink)" />
        <polygon points="30.2,15 41.42,15 41.42,47.2 35.81,40.2 30.2,47.2" fill="var(--color-paper)" />
      </svg>
    </div>
  );
}
