import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSermonRecs } from "@/lib/sermons/fetch";
import { Card } from "@/components/ui/Card";

interface Props {
  bookId: number;
  chapter: number;
  /** Last chapter of the reading segment, when it spans more than one
   * chapter (e.g. today's plan covers chapters 14–18) — lets topic
   * derivation cover themes from the whole segment, not just `chapter`. */
  chapterTo?: number;
  bookNameHu: string;
  focusNote?: string | null;
}

/** Async server component — kept out of the main data Promise.all and
 * wrapped in Suspense at call sites, since a cache-miss can mean a real
 * network round trip (AI topic call + per-preacher YouTube search). */
export async function SermonRecs({ bookId, chapter, chapterTo, bookNameHu, focusNote }: Props) {
  const supabase = await createClient();
  const recs = await getSermonRecs(supabase, bookId, chapter, bookNameHu, focusNote ?? null, chapterTo);
  if (recs.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">Kapcsolódó tanítások</h2>
        <Link href="/prediktorok" className="text-xs text-ink-faint underline underline-offset-4 hover:text-ink-muted">
          Prédikátorok
        </Link>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {recs.map((r) => (
          <a key={r.video_id} href={`https://www.youtube.com/watch?v=${r.video_id}`} target="_blank" rel="noreferrer">
            <Card className="flex items-center gap-3 p-3">
              {r.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- small external YouTube thumbnail, not worth a remotePatterns config
                <img src={r.thumbnail_url} alt="" width={96} height={54} className="h-14 w-24 shrink-0 rounded object-cover" />
              ) : (
                <div className="h-14 w-24 shrink-0 rounded bg-line" />
              )}
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-extrabold text-ink">{r.title}</p>
                <p className="mt-0.5 text-xs text-ink-faint">{r.preacher_name}</p>
              </div>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );
}
