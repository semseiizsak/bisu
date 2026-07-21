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

const TOPIC_SYSTEM = `Bibliai fejezet fő témáit gyűjtöd ki rövid kulcsszavakban, amiket
YouTube-keresésre fogunk használni magyar nyelvű bibliai tanításokhoz. A
kulcsszavak egy keresőmezőbe kerülnek egymás mellé, ezért KRITIKUS, hogy
rövidek legyenek — egy hosszú, leíró kifejezésekből összefűzött lekérdezésre
gyakorlatilag sosem talál a YouTube semmit.
Szabályok:
- 2-4 kulcsszó, MINDEGYIK 1, legfeljebb 2 szóból álljon.
- Tulajdonnevek (szereplők, helyszínek) és önálló fogalmak — NE leíró
  kifejezések vagy tagmondatok.
- Jó példák: "Melkisédek", "tized", "Ábrahám", "bűnbeesés", "özönvíz".
- Rossz példák (túl hosszúak, ne írj ilyet): "Ábrahám győzelme a királyok felett",
  "az ember bűnbeesése a kertben", "Lót megszabadítása Sodomából".
- Válaszolj KIZÁRÓLAG ezzel a JSON formával: {"keywords": ["...", "..."]}`;

async function deriveTopics(bookNameHu: string, chapter: number, focusNote: string | null): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) return [bookNameHu, focusNote ?? ""].filter(Boolean);
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: TOPIC_SYSTEM },
        { role: "user", content: `Könyv: ${bookNameHu} ${chapter}. fejezet${focusNote ? `\nFókusz: ${focusNote}` : ""}` },
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
          .slice(0, 4)
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

async function searchYoutube(query: string, channelId: string | null, apiKey: string): Promise<YoutubeItem[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "3",
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
      return [];
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
    return items;
  } catch (err) {
    console.error(`[sermons] YouTube search threw for "${query}":`, err instanceof Error ? err.message : err);
    return [];
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
 * Related-teachings lookup for a chapter, cached 7 days per (book, chapter).
 * `day_topics.generated_at` doubles as the "already tried this chapter"
 * marker so a chapter with zero matches doesn't get re-queried against the
 * YouTube API on every load. Returns [] (section stays hidden) whenever
 * YOUTUBE_API_KEY isn't configured yet.
 */
export async function getSermonRecs(db: DB, bookId: number, chapter: number, bookNameHu: string, focusNote: string | null): Promise<SermonRec[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

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

  const keywords = await deriveTopics(bookNameHu, chapter, focusNote);
  // Keep the search query itself short — YouTube's relevance ranking degrades
  // fast as more terms get ANDed together, so use the top couple of keywords
  // (all `keywords` are still stored/shown; this only trims what gets searched).
  const query = keywords.slice(0, 2).join(" ");

  const recs: SermonRec[] = [];
  const upsertRows: Database["public"]["Tables"]["sermon_recs"]["Insert"][] = [];
  for (const p of preachers) {
    const items = await searchYoutube(`${query} ${p.query_modifier}`.trim(), p.channel_id, apiKey);
    for (const it of items) {
      recs.push({ ...it, preacher_name: p.name });
      upsertRows.push({
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

  await Promise.all([
    admin.from("day_topics").upsert({ book_id: bookId, chapter, keywords, generated_at: now }),
    upsertRows.length ? admin.from("sermon_recs").upsert(upsertRows, { onConflict: "book_id,chapter,video_id" }) : Promise.resolve(),
  ]);

  return recs.slice(0, 6);
}
