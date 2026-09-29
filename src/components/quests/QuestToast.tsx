"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { acknowledgeQuests } from "@/lib/quests/acknowledge";

interface QuestInfo {
  quest_key: string;
  label_hu: string;
  xp: number;
}

/** Mirrors BadgeToast: dedupes by quest_key so a prop that keeps referencing
 * an already-toasted quest (e.g. after a re-render) doesn't requeue it. */
export function QuestToast({ dayIdx, quests }: { dayIdx: number; quests: QuestInfo[] }) {
  const [queue, setQueue] = useState<QuestInfo[]>([]);
  const seenKeys = useRef(new Set<string>());

  useEffect(() => {
    const fresh = quests.filter((q) => !seenKeys.current.has(q.quest_key));
    if (fresh.length === 0) return;
    for (const q of fresh) seenKeys.current.add(q.quest_key);
    setQueue((q) => [...q, ...fresh]);
    void acknowledgeQuests(dayIdx, fresh.map((q) => q.quest_key));
  }, [dayIdx, quests]);

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
            key={current.quest_key}
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-3xl border-2 border-good/50 bg-good/15 p-4 shadow-lg backdrop-blur"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-good text-2xl shadow-[0_3px_0_0_var(--color-good-deep)]">⭐</div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-good">Bónusz teljesítve!</p>
              <p className="font-black text-ink">{current.label_hu}</p>
              <p className="text-xs font-black text-good">+{current.xp} XP</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
