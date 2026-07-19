"use client";

import { useEffect } from "react";

/**
 * Installed as a home-screen PWA, this app has no browser chrome to
 * hard-refresh from — reopening the icon just resumes whatever was already
 * frozen in memory. This checks the live deployed build id whenever the app
 * comes back to the foreground and reloads if it's stale, so a new deploy is
 * picked up on the next open instead of requiring the user to know to force-
 * quit and relaunch.
 */
export function AppUpdateWatcher() {
  useEffect(() => {
    const currentBuildId = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!currentBuildId || currentBuildId === "dev") return;

    async function checkForUpdate() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { buildId } = (await res.json()) as { buildId?: string };
        if (buildId && buildId !== currentBuildId) {
          window.location.reload();
        }
      } catch {
        // offline or transient failure — just try again next time the app is opened
      }
    }

    document.addEventListener("visibilitychange", checkForUpdate);
    return () => document.removeEventListener("visibilitychange", checkForUpdate);
  }, []);

  return null;
}
