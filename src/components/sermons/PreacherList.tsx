"use client";

import { useState, useTransition } from "react";
import { addPreacher, removePreacher, setPreacherEnabled } from "@/lib/actions/preachers";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/cx";

export interface PreacherRow {
  id: number;
  name: string;
  channel_id: string | null;
  query_modifier: string;
  enabled: boolean;
}

export function PreacherList({ preachers }: { preachers: PreacherRow[] }) {
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [modifier, setModifier] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim() || pending) return;
    startTransition(async () => {
      await addPreacher({ name, channel_id: channelId, query_modifier: modifier });
      setName("");
      setChannelId("");
      setModifier("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {preachers.map((p) => (
          <Card key={p.id} className={cx("flex items-center justify-between px-4 py-3", !p.enabled && "opacity-60")}>
            <div>
              <p className="font-extrabold text-ink">{p.name}</p>
              <p className="text-xs text-ink-faint">{p.channel_id ? `Csatorna: ${p.channel_id}` : p.query_modifier || "—"}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => startTransition(() => setPreacherEnabled(p.id, !p.enabled))}
                disabled={pending}
                className="text-xs font-extrabold text-accent underline underline-offset-4 disabled:opacity-50"
              >
                {p.enabled ? "Letiltom" : "Engedélyezem"}
              </button>
              <button
                onClick={() => startTransition(() => removePreacher(p.id))}
                disabled={pending}
                className="text-xs text-ink-faint underline underline-offset-4 hover:text-ink-muted disabled:opacity-50"
              >
                Törlöm
              </button>
            </div>
          </Card>
        ))}
        {preachers.length === 0 && <p className="text-ink-muted">Még nincs prédikátor felvéve.</p>}
      </div>

      <Card className="p-4">
        <p className="text-sm font-extrabold text-ink">Új prédikátor</p>
        <div className="mt-2 flex flex-col gap-2">
          <Input placeholder="Név" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="YouTube csatorna ID (opcionális)" value={channelId} onChange={(e) => setChannelId(e.target.value)} />
          <Input placeholder="Keresési kiegészítés (pl. tanítás)" value={modifier} onChange={(e) => setModifier(e.target.value)} />
          <Button size="sm" onClick={submit} disabled={!name.trim() || pending}>
            {pending ? "Mentés…" : "Hozzáadás"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
