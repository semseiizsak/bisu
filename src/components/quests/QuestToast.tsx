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
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="pointer-events-auto w-full max-w-sm rounded-lg border border-line-strong bg-surface p-4 shadow-lg"
          >
            <p className="text-sm font-extrabold text-accent">Küldetés teljesítve!</p>
            <p className="mt-0.5 font-extrabold text-ink">{current.label_hu}</p>
            <p className="mt-0.5 text-sm text-ink-muted">+{current.xp} XP</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
