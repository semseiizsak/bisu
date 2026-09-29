"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { acknowledgeBadges } from "@/lib/badges/acknowledge";
import { badgeEmoji } from "@/components/badges/BadgeGrid";

interface BadgeInfo {
  id: string;
  category: string;
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
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 3600);
    return () => clearTimeout(t);
  }, [queue]);

  const current = queue[0];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-3xl border-2 border-gold/60 bg-gold/20 p-4 shadow-lg backdrop-blur"
          >
            <div className="shine flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold text-3xl shadow-[0_3px_0_0_var(--color-gold-deep)]">
              {badgeEmoji(current)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-gold-deep">Új jelvény!</p>
              <p className="font-black text-ink">{current.label_hu}</p>
              <p className="text-xs font-semibold text-ink-muted">{current.description_hu}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
