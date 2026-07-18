"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { acknowledgeBadges } from "@/lib/badges/acknowledge";

interface BadgeInfo {
  id: string;
  label_hu: string;
  description_hu: string;
}

/** Accepts `badges` from a server-rendered prop (fires once) or from a
 * client action's return value assigned into state later (fires again when
 * the array changes) — either way, each badge id is only ever queued once. */
export function BadgeToast({ badges }: { badges: BadgeInfo[] }) {
  const [queue, setQueue] = useState<BadgeInfo[]>([]);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    const fresh = badges.filter((b) => !seenIds.current.has(b.id));
    if (fresh.length === 0) return;
    for (const b of fresh) seenIds.current.add(b.id);
    setQueue((q) => [...q, ...fresh]);
    void acknowledgeBadges(fresh.map((b) => b.id));
  }, [badges]);

  useEffect(() => {
    if (queue.length === 0) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 3200);
    return () => clearTimeout(t);
  }, [queue]);

  const current = queue[0];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="pointer-events-auto w-full max-w-sm rounded-lg border border-line-strong bg-surface p-4 shadow-lg"
          >
            <p className="text-sm font-extrabold text-accent">Új jelvény!</p>
            <p className="mt-0.5 font-extrabold text-ink">{current.label_hu}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{current.description_hu}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
