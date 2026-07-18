"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { approveFact, updateFact } from "@/app/admin/facts/actions";

interface FactRow {
  id: number;
  fact_key: string;
  fact_value: string;
  verse_ref: string;
  confidence: number;
  verified: boolean;
  entity_name: string;
  chapter: number | null;
}

export function FactReviewList({ facts }: { facts: FactRow[] }) {
  const [rows, setRows] = useState(facts);
  const [cursor, setCursor] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing) {
        if (e.key === "Escape") setEditing(false);
        return;
      }
      if (e.key === "j") setCursor((c) => Math.min(c + 1, rows.length - 1));
      else if (e.key === "k") setCursor((c) => Math.max(c - 1, 0));
      else if (e.key === "Enter") {
        const row = rows[cursor];
        if (!row) return;
        setRows((r) => r.map((x) => (x.id === row.id ? { ...x, verified: true } : x)));
        void approveFact(row.id);
      } else if (e.key === "e") {
        const row = rows[cursor];
        if (!row) return;
        setDraft(row.fact_value);
        setEditing(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, rows, editing]);

  async function saveEdit() {
    const row = rows[cursor];
    if (!row) return;
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, fact_value: draft, verified: true } : x)));
    setEditing(false);
    await updateFact(row.id, draft);
  }

  if (rows.length === 0) {
    return <p className="mt-8 text-ink-muted">Nincs átnézésre váró tény. 🎉</p>;
  }

  return (
    <ul className="mt-6 divide-y divide-line border border-line rounded-lg overflow-hidden">
      {rows.map((f, i) => {
        const active = i === cursor;
        return (
          <li
            key={f.id}
            className={cx(
              "px-4 py-3 transition-colors duration-[var(--dur-fast)]",
              active ? "bg-ink/5" : "bg-surface",
              f.verified && "opacity-50",
            )}
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-extrabold text-ink">{f.entity_name}</span>
              <span className="text-xs text-ink-faint">{f.verse_ref}</span>
            </div>
            <div className="mt-1 text-sm text-ink-muted">{f.fact_key.replace(/_/g, " ")}</div>
            {active && editing ? (
              <div className="mt-2 flex gap-2">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  className="flex-1 rounded border border-line-strong bg-paper px-2 py-1 text-ink"
                />
              </div>
            ) : (
              <div className="mt-1 text-ink">{f.fact_value}</div>
            )}
            <div className="mt-1 text-xs text-ink-faint">
              confidence: {f.confidence.toFixed(2)} {f.verified && "· jóváhagyva"}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
