import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";

type DB = SupabaseClient<Database>;

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SermonRec {
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string | null;
  preacher_name: string;
}

function isFresh(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < TTL_MS;
}

function foldDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Significant name tokens (3+ letters) used to check that a search hit is
 * actually about/by this preacher — YouTube's `q` match is loose enough that
 * unrelated channels regularly surface just from keyword overlap (e.g. a
 * dramatized-retelling channel matching on "Ábrahám szövetség"). */
function nameTokens(name: string): string[] {
  return foldDiacritics(name)
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function matchesPreacher(item: YoutubeItem, tokens: string[]): boolean {
  // Require every token (not just one) — a lone token like "hit" ("faith")
  // from "Hit Gyülekezete" is far too common a word to prove relevance by
  // itself, but the full name together reliably does.
  const haystack = foldDiacritics(`${item.title} ${item.channel_title}`);
  return tokens.every((t) => haystack.includes(t));
}

/** True if the video's title actually seems to be about one of the
 * chapter's own topics — being from the right preacher is not enough on its
 * own, since a trusted channel also posts prophecies, conference promos and
 * organizational announcements that have nothing to do with the reading. Uses
 * a short prefix match (not full-word) so Hungarian's case suffixes
 * ("Ábrahámmal", "Ábrahámnak") and spelling variants ("Melkisédek" vs
 * "melkicedeki") still count as a match. */
function matchesTopic(item: YoutubeItem, keywords: string[]): boolean {
  const title = foldDiacritics(item.title);
  return keywords.some((kw) => {
    const folded = foldDiacritics(kw);
    const prefix = folded.slice(0, Math.min(5, folded.length));
    return prefix.length > 0 && title.includes(prefix);
  });
}

const TOPIC_SYSTEM = `Bibliai szakasz fő témáit gyűjtöd ki rövid kulcsszavakban, amiket
YouTube-keresésre fogunk használni magyar nyelvű bibliai tanításokhoz. A
kulcsszavak egy keresőmezőbe kerülnek egymás mellé, ezért KRITIKUS, hogy
rövidek legyenek — egy hosszú, leíró kifejezésekből összefűzött lekérdezésre
gyakorlatilag sosem talál a YouTube semmit.
Szabályok:
- MINDEGYIK kulcsszó 1, legfeljebb 2 szóból álljon.
- Ha a szakasz több fejezetet ölel fel, MINDEN EGYES fejezetből emelj ki
  legalább egy saját, arra a fejezetre jellemző témát — egy N fejezetes
  szakasznál tehát legalább N kulcsszót adj, egyet-egyet fejezetenként (plusz
  további átfogó témákat, ha van hely). Ne engedd, hogy a lista csak az első
  1-2 fejezet témáival teljen meg.
- Tulajdonnevek (szereplők, helyszínek) és önálló fogalmak — NE leíró
  kifejezések vagy tagmondatok.
- Jó példák: "Melkisédek", "tized", "Ábrahám", "közbenjárás", "bűnbeesés", "özönvíz".
- Rossz példák (túl hosszúak, ne írj ilyet): "Ábrahám győzelme a királyok felett",
  "az ember bűnbeesése a kertben", "Lót megszabadítása Sodomából".
- Válaszolj KIZÁRÓLAG ezzel a JSON formával: {"keywords": ["...", "..."]}`;

async function deriveTopics(bookNameHu: string, chapterFrom: number, chapterTo: number, focusNote: string | null): Promise<string[]> {
  const chapterCount = chapterTo - chapterFrom + 1;
  const chapterLabel = chapterTo > chapterFrom ? `${chapterFrom}–${chapterTo}. fejezetek (${chapterCount} fejezet)` : `${chapterFrom}. fejezet`;
  if (!process.env.OPENAI_API_KEY) return [bookNameHu, focusNote ?? ""].filter(Boolean);
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: TOPIC_SYSTEM },
        { role: "user", content: `Könyv: ${bookNameHu} ${chapterLabel}${focusNote ? `\nFókusz: ${focusNote}` : ""}` },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { keywords?: unknown };
    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords
          // Defense in depth against the model still returning a descriptive
          // clause instead of a short term — a query built from long phrases
          // reliably returns zero YouTube results (verified live).
          .filter((k): k is string => typeof k === "string" && k.trim().length > 0 && k.trim().split(/\s+/).length <= 2)
          .slice(0, Math.max(6, chapterCount + 2))
      : [];
    if (keywords.length) return keywords;
  } catch {
    // fall through to the book-name fallback below
  }
  return [bookNameHu, focusNote ?? ""].filter(Boolean);
}

interface YoutubeItem {
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string | null;
  published_at: string | null;
}

interface YoutubeSearchResult {
  items: YoutubeItem[];
  /** True on a 429/quota-exceeded response — the caller must not cache this
   * as "no matches for this chapter", since it says nothing about whether
   * matches actually exist, only that today's YouTube search budget (100
   * calls/day on the default free quota) ran out. */
  quotaExceeded: boolean;
}

async function searchYoutube(query: string, channelId: string | null, apiKey: string): Promise<YoutubeSearchResult> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "5",
    relevanceLanguage: "hu",
    q: query,
    key: apiKey,
  });
  if (channelId) params.set("channelId", channelId);

  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[sermons] YouTube search failed (${res.status}) for "${query}":`, body.slice(0, 500));
      return { items: [], quotaExceeded: res.status === 429 };
    }
    const json = (await res.json()) as {
      items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } } }[];
    };
    const items: YoutubeItem[] = [];
    for (const it of json.items ?? []) {
      const videoId = it.id?.videoId;
      if (!videoId || !it.snippet?.title) continue;
      items.push({
        video_id: videoId,
        title: it.snippet.title,
        channel_title: it.snippet.channelTitle ?? "",
        thumbnail_url: it.snippet.thumbnails?.medium?.url ?? it.snippet.thumbnails?.default?.url ?? null,
        published_at: it.snippet.publishedAt ?? null,
      });
    }
    return { items, quotaExceeded: false };
  } catch (err) {
    console.error(`[sermons] YouTube search threw for "${query}":`, err instanceof Error ? err.message : err);
    return { items: [], quotaExceeded: false };
  }
}

async function readCachedRecs(db: DB, bookId: number, chapter: number): Promise<SermonRec[]> {
  const { data: recs } = await db
    .from("sermon_recs")
    .select("video_id, title, channel_title, thumbnail_url, preacher_id")
    .eq("book_id", bookId)
    .eq("chapter", chapter);
  if (!recs?.length) return [];

  const { data: preachers } = await db.from("preachers").select("id, name").in("id", Array.from(new Set(recs.map((r) => r.preacher_id))));
  const nameById = new Map((preachers ?? []).map((p) => [p.id, p.name]));

  return recs.map((r) => ({
    video_id: r.video_id,
    title: r.title,
    channel_title: r.channel_title,
    thumbnail_url: r.thumbnail_url,
    preacher_name: nameById.get(r.preacher_id) ?? "",
  }));
}

/**
 * Related-teachings lookup for a chapter (or chapter range), cached 7 days
 * per (book, chapterFrom). `day_topics.generated_at` doubles as the
 * "already tried this chapter" marker so a chapter with zero matches
 * doesn't get re-queried against the YouTube API on every load. Returns []
 * (section stays hidden) whenever YOUTUBE_API_KEY isn't configured yet.
 */
export async function getSermonRecs(
  db: DB,
  bookId: number,
  chapterFrom: number,
  bookNameHu: string,
  focusNote: string | null,
  chapterTo: number = chapterFrom,
): Promise<SermonRec[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const chapter = chapterFrom; // cache key — see doc comment above
  const { data: topicsRow } = await db.from("day_topics").select("keywords, generated_at").eq("book_id", bookId).eq("chapter", chapter).maybeSingle();
  if (topicsRow && isFresh(topicsRow.generated_at)) {
    return readCachedRecs(db, bookId, chapter);
  }

  const { data: preachers } = await db.from("preachers").select("*").eq("enabled", true);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (!preachers?.length) {
    await admin.from("day_topics").upsert({ book_id: bookId, chapter, keywords: [], generated_at: now });
    return [];
  }

  const keywords = await deriveTopics(bookNameHu, chapterFrom, chapterTo, focusNote);

  const key: string = apiKey; // narrow once — TS doesn't carry the early-return narrowing into the closure below
  type PreacherRow = NonNullable<typeof preachers>[number];

  // One query per (keyword, preacher) pair — a single joined query ("Ábrahám
  // szövetség Derek Prince magyarul tanítás") ranks worse and less reliably
  // than searching each topic on its own, which is what actually surfaced
  // good results when tried by hand. Each hit is then required to actually
  // mention the preacher (by name, in title or channel) before it's kept —
  // YouTube's relevance search readily returns videos from unrelated
  // channels that just happen to share the keyword text. Search every
  // derived keyword (not just the first few) — for a multi-chapter reading
  // segment, a chapter's only distinguishing theme can legitimately be the
  // last keyword in the list.
  const searchKeywords = keywords;
  const recsByPreacher: SermonRec[][] = [];
  const rows: Database["public"]["Tables"]["sermon_recs"]["Insert"][] = [];
  const seenVideoIds = new Set<string>();
  let quotaExceeded = false;

  for (const p of preachers as PreacherRow[]) {
    const tokens = nameTokens(p.name);
    const preacherRecs: SermonRec[] = [];
    for (const kw of searchKeywords) {
      const { items, quotaExceeded: hitQuota } = await searchYoutube(`${kw} ${p.query_modifier}`.trim(), p.channel_id, key);
      if (hitQuota) quotaExceeded = true;
      for (const it of items) {
        if (seenVideoIds.has(it.video_id)) continue;
        if (!p.channel_id && !matchesPreacher(it, tokens)) continue;
        if (!matchesTopic(it, searchKeywords)) continue;
        seenVideoIds.add(it.video_id);
        preacherRecs.push({ ...it, preacher_name: p.name });
        rows.push({
          book_id: bookId,
          chapter,
          video_id: it.video_id,
          preacher_id: p.id,
          title: it.title,
          channel_title: it.channel_title,
          thumbnail_url: it.thumbnail_url,
          published_at: it.published_at,
          fetched_at: now,
        });
      }
    }
    recsByPreacher.push(preacherRecs);
  }

  // A quota-exhausted run says nothing about whether real matches exist, so
  // don't stamp day_topics — that would lock in a false "no matches" cache
  // for the full 7-day TTL. Whatever few rows *did* come back before the
  // quota ran out are still worth caching, just not the "already tried"
  // marker itself.
  await Promise.all([
    quotaExceeded ? Promise.resolve() : admin.from("day_topics").upsert({ book_id: bookId, chapter, keywords, generated_at: now }),
    rows.length ? admin.from("sermon_recs").upsert(rows, { onConflict: "book_id,chapter,video_id" }) : Promise.resolve(),
  ]);

  // Round-robin across preachers rather than exhausting one before the next
  // — a preacher earlier in the list otherwise crowds the whole top-10 out
  // even when every other preacher also has good, relevant matches.
  const recs: SermonRec[] = [];
  for (let i = 0; recs.length < 10 && recsByPreacher.some((list) => i < list.length); i++) {
    for (const list of recsByPreacher) {
      if (i < list.length) recs.push(list[i]);
      if (recs.length >= 10) break;
    }
  }
  return recs;
}
