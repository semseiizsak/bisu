import { Card } from "@/components/ui/Card";
import type { Database } from "@/lib/supabase/types";

export type ChapterNoteRow = Database["public"]["Tables"]["chapter_notes"]["Row"];

/** The per-chapter study note: what happened, where it sits in the story,
 * the verse to remember, and where else the Bible picks the thread up. */
export function ChapterNote({ note, compact = false }: { note: ChapterNoteRow; compact?: boolean }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Fejezet-jegyzet</p>
      <p className="mt-2 text-ink leading-relaxed">{note.summary}</p>

      {!compact && note.context && (
        <div className="mt-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Hol tartunk</p>
          <p className="mt-1 text-ink-muted leading-relaxed">{note.context}</p>
        </div>
      )}

      {note.key_verse_ref && (
        <div className="mt-4 rounded-md border border-line-strong bg-paper px-3 py-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Kulcsvers · {note.key_verse_ref}</p>
          {note.key_verse_why && <p className="mt-1 text-sm text-ink">{note.key_verse_why}</p>}
        </div>
      )}

      {!compact && note.cross_refs.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">Kapcsolódó igék</p>
          <ul className="mt-1 flex flex-col gap-1.5">
            {note.cross_refs.map((c) => (
              <li key={c.ref} className="text-sm text-ink-muted">
                <span className="font-extrabold text-ink">{c.ref}</span>
                {c.why ? ` — ${c.why}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {note.themes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {note.themes.map((t) => (
            <span key={t} className="rounded-full bg-line px-2.5 py-1 text-xs text-ink-muted">
              {t}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
