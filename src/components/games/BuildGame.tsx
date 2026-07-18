"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useGameScore } from "@/lib/review/use-game-score";
import type { PersistedCardState } from "@/lib/fsrs/engine";

interface Field {
  label: string;
  answer: number;
  unit: string | null;
  cardId: number | null;
  state: PersistedCardState | null;
}

export function BuildGame({ fields }: { fields: Field[] }) {
  const [values, setValues] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);
  const { submit } = useGameScore("game:build");

  async function check() {
    setChecked(true);
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!f.cardId || !f.state) continue;
      const correct = Number(values[i]) === f.answer;
      await submit(f.cardId, f.state, correct ? 3 : 1);
    }
  }

  const correctCount = fields.filter((f, i) => Number(values[i]) === f.answer).length;

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3">
        {fields.map((f, i) => {
          const isCorrect = checked && Number(values[i]) === f.answer;
          const isWrong = checked && Number(values[i]) !== f.answer;
          return (
            <div key={i} className="flex items-center justify-between gap-3">
              <label className="text-ink-muted capitalize">{f.label}</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  disabled={checked}
                  value={values[i] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [i]: e.target.value }))}
                  className="w-24"
                />
                {f.unit && <span className="text-sm text-ink-faint">{f.unit}</span>}
                {isCorrect && <span className="text-good">✓</span>}
                {isWrong && <span className="text-bad">{f.answer}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {!checked ? (
        <Button className="mt-5 w-full" onClick={check}>
          Ellenőrzés
        </Button>
      ) : (
        <p className="mt-5 text-center font-extrabold text-ink">
          {correctCount} / {fields.length} helyes
        </p>
      )}
    </div>
  );
}
