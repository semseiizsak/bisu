"use client";

import { useEffect } from "react";
import { finishSession } from "@/lib/actions/session-done";

/**
 * Render inside any "done" screen (quiz or game). Reconciles XP once and
 * drops the client router cache for /ma and /haladas, so the next tab
 * switch shows the finished state instead of a 30s-old snapshot.
 */
export function SessionEnd({ dayIdx = null }: { dayIdx?: number | null }) {
  useEffect(() => {
    void finishSession(dayIdx).catch(() => {
      // best-effort: the cache expires on its own within 30s anyway
    });
  }, [dayIdx]);
  return null;
}
