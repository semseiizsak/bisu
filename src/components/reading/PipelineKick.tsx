"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface Props {
  chapters: { book: string; chapter: number }[];
  /** Compact inline variant for the /ma checklist. */
  compact?: boolean;
}

/**
 * Generates notes + questions for chapters that don't have them yet, right
 * when they're needed. The nightly cron covers the next few days of the
 * plan, but a reader who jumps ahead, or comes back after a long break,
 * shouldn't have to wait for tomorrow's cron.
 */
export function PipelineKick({ chapters, compact = false }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const started = useRef(false);

  async function run() {
    setStatus("running");
    try {
      const res = await fetch("/api/pipeline/jit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapters }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const summary = (await res.json()) as { chapters?: { status: string }[] };
      const anyError = summary.chapters?.some((c) => c.status === "error");
      setStatus(anyError ? "error" : "done");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    if (started.current || chapters.length === 0) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (chapters.length === 0) return null;

  const label =
    status === "running"
      ? "Kérdések és jegyzet készülnek ehhez a fejezethez…"
      : status === "error"
        ? "Nem sikerült elkészíteni a kérdéseket."
        : status === "done"
          ? "Kész — frissítés…"
          : "";

  return (
    <div className={compact ? "flex items-center justify-between gap-3 text-sm" : "rounded-3xl border-2 border-line bg-surface p-4"}>
      <p className={status === "error" ? "text-bad" : "text-ink-muted"}>
        {status === "running" && <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent align-middle" />}
        {label}
      </p>
      {status === "error" && (
        <Button size="sm" variant="secondary" onClick={run} className={compact ? "" : "mt-3"}>
          Újra
        </Button>
      )}
    </div>
  );
}
