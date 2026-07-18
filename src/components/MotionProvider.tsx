"use client";

import { MotionConfig } from "framer-motion";

/** Makes every framer-motion animation in the tree respect the OS reduced-motion setting — the global CSS rule only catches plain CSS transitions/animations, not framer-motion's JS-driven ones. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
