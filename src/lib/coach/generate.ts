import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeStreak } from "@/lib/streak/compute";
import { BOOKS } from "@/lib/content/books";
import { ERA_LABELS } from "@/lib/content/eras";

type DB = SupabaseClient<Database>;

const MIN_REVIEWS = 20;

function budapestParts(d: Date): { y: number; m: number; day: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: Number(get("year")), m: Number(get("month")), day: Number(get("day")), weekday: weekdayMap[get("weekday")] ?? 1 };
}

/** Monday of the current week in Europe/Budapest, as YYYY-MM-DD. */
export function currentWeekStart(now: Date = new Date()): string {
  const { y, m, day, weekday } = budapestParts(now);
  const utcMidnight = Date.UTC(y, m - 1, day);
  const daysSinceMonday = (weekday + 6) % 7; // Mon=0 ... Sun=6
  return new Date(utcMidnight - daysSinceMonday * 86_400_000).toISOString().slice(0, 10);
}

interface WeekStats {
  week_start: string;
  reviewCount: number;
  accuracy: number;
  readingDays: number;
  streakCurrent: number;
  streakLongest: number;
  weakSpots: string[];
}

async function aggregateWeekStats(db: DB, weekStart: string): Promise<WeekStats | null> {
  const weekStartIso = `${weekStart}T00:00:00.000Z`;

  const { data: ratings } = await db.from("reviews").select("rating").eq("mode", "srs").gte("reviewed_at", weekStartIso);
  const reviewCount = ratings?.length ?? 0;
  if (reviewCount < MIN_REVIEWS) return null;

  const correct = (ratings ?? []).filter((r) => r.rating >= 3).length;
  const accuracy = reviewCount ? correct / reviewCount : 0;

  const { data: readingRows } = await db.from("reading_log").select("completed_at").not("completed_at", "is", null).gte("completed_at", weekStartIso);
  const readingDays = readingRows?.length ?? 0;

  const streak = await computeStreak(db);

  // Same weak-points query and label resolution as /haladas.
  const { data: weakScopes } = await db
    .from("mastery")
    .select("scope_type, scope_id, score, card_count")
    .gte("card_count", 5)
    .order("score", { ascending: true })
    .limit(3);
  const entityIds = (weakScopes ?? []).filter((s) => s.scope_type === "entity").map((s) => Number(s.scope_id.split(":")[1]));
  const { data: entities } = entityIds.length ? await db.from("entities").select("id, name_hu").in("id", entityIds) : { data: [] };
  const entityNameById = new Map((entities ?? []).map((e) => [e.id, e.name_hu]));
  const bookNameBySlug = new Map(BOOKS.map((b) => [b.slug, b.name_hu]));
  const weakSpots = (weakScopes ?? []).map((s) => {
    const label =
      s.scope_type === "book"
        ? (bookNameBySlug.get(s.scope_id) ?? s.scope_id)
        : s.scope_type === "entity"
          ? (entityNameById.get(Number(s.scope_id.split(":")[1])) ?? s.scope_id)
          : s.scope_type === "era"
            ? (ERA_LABELS[s.scope_id] ?? s.scope_id)
            : s.scope_id;
    return `${label} (${Math.round(s.score * 100)}%)`;
  });

  return { week_start: weekStart, reviewCount, accuracy, readingDays, streakCurrent: streak.current, streakLongest: streak.longest, weakSpots };
}

const COACH_SYSTEM = `Bibliai memorizáló app edzője vagy. A megadott heti statisztikákból írsz rövid,
tegeződő, bátorító, de őszinte visszajelzést magyarul. Szabályok:
- KIZÁRÓLAG a megadott számokra és tényekre támaszkodj — semmit ne találj ki.
- Pontosan ez a szerkezet, ~250 szó: "Mi ment jól", "Amin csúszol", "Fókusz a jövő hétre" (mint alcímek).
- Konkrét, cselekvésre ösztönző, edzői hangnem — ne legyen general platitűd.
- Válaszolj sima szöveggel (nem JSON), a három alcímmel tagolva.`;

/**
 * If this week's (Monday, Europe/Budapest) report is missing and there's
 * enough signal (>=20 reviews), aggregates the same stats already shown on
 * /haladas and asks gpt-4o for a short coaching note. Upsert on week_start
 * collapses concurrent-generation races. Returns null when there's nothing
 * to show yet (either too little data, or OPENAI_API_KEY isn't set).
 */
export async function getOrGenerateCoachReport(db: DB, now: Date = new Date()): Promise<{ body: string; week_start: string } | null> {
  const weekStart = currentWeekStart(now);

  const { data: existing } = await db.from("coach_reports").select("week_start, body").eq("week_start", weekStart).maybeSingle();
  if (existing) return existing;

  if (!process.env.OPENAI_API_KEY) return null;

  const stats = await aggregateWeekStats(db, weekStart);
  if (!stats) return null;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const userContent = [
    `Ismétlések ezen a héten: ${stats.reviewCount}`,
    `Pontosság: ${Math.round(stats.accuracy * 100)}%`,
    `Olvasott napok: ${stats.readingDays}`,
    `Jelenlegi sorozat: ${stats.streakCurrent} nap`,
    `Leghosszabb sorozat: ${stats.streakLongest} nap`,
    stats.weakSpots.length ? `Leggyengébb területek: ${stats.weakSpots.join(", ")}` : "Nincs kiugróan gyenge terület.",
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: COACH_SYSTEM },
      { role: "user", content: userContent },
    ],
  });
  const body = completion.choices[0]?.message?.content?.trim();
  if (!body) return null;

  const admin = createAdminClient();
  const { data: saved, error } = await admin
    .from("coach_reports")
    .upsert({ week_start: weekStart, body, stats: stats as unknown as Record<string, unknown> }, { onConflict: "week_start" })
    .select("week_start, body")
    .single();
  if (error) return { body, week_start: weekStart };
  return saved;
}
