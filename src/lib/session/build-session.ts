import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { SRS_CARD_TYPES, type CardType } from "@/lib/content/difficulty";
import { estimateCardMinutes, estimateReadingMinutes } from "@/lib/session/time-estimates";
import type { SessionBlock, SessionPlan, SessionMode } from "@/lib/session/types";
import { currentDayIndex } from "@/lib/session/current-day";
import { DEFAULT_DAILY_BUDGET_MINUTES, DEFAULT_NEW_CARDS_PER_DAY, SHORT_SESSION_MINUTES } from "@/lib/session/constants";
import { availableGames, pickGame } from "@/lib/games/availability";

type DB = SupabaseClient<Database>;


/** How many previous plan days count as "just read" for new-card priority. */
const RECENT_READING_DAYS = 2;

interface ChapterRef {
  book_id: number;
  chapter: number;
}

function expandSegments(segments: { book_slug: string; ch_from: number; ch_to: number }[], bookBySlug: Map<string, number>): ChapterRef[] {
  const out: ChapterRef[] = [];
  for (const seg of segments) {
    const bookId = bookBySlug.get(seg.book_slug);
    if (!bookId) continue;
    for (let ch = seg.ch_from; ch <= seg.ch_to; ch++) out.push({ book_id: bookId, chapter: ch });
  }
  return out;
}

/** Group chapter refs by book so each book costs one query, not one per chapter. */
function chaptersByBook(chapters: ChapterRef[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const c of chapters) {
    if (!map.has(c.book_id)) map.set(c.book_id, []);
    map.get(c.book_id)!.push(c.chapter);
  }
  return map;
}

async function verseCountForChapters(db: DB, chapters: ChapterRef[]): Promise<number> {
  const counts = await Promise.all(
    Array.from(chaptersByBook(chapters)).map(async ([bookId, chs]) => {
      const { count } = await db.from("verses").select("id", { count: "exact", head: true }).eq("book_id", bookId).in("chapter", chs);
      return count ?? 0;
    }),
  );
  return counts.reduce((s, n) => s + n, 0);
}

/**
 * Builds the day's plan: reading (from the plan), due reviews, new cards
 * from the chapters just read, a weak-spot block and the day's game.
 *
 * Only the quiz card types (question / manual recall / memorized verse)
 * ever enter the quiz blocks; locate / order / chain / map cards belong
 * to the games and are never mixed in.
 *
 * Round-trips are batched: three waves of parallel queries instead of a
 * sequential chain, which is what made the Today page take seconds.
 */
export async function buildSessionPlan(db: DB, now: Date = new Date(), mode: SessionMode = "full", knownDayIdx?: number): Promise<SessionPlan> {
  // Wave 1: settings, books, day index.
  const [{ data: settingsRow }, { data: booksRows }, dayIdx] = await Promise.all([
    db.from("settings").select("daily_budget_minutes, new_cards_per_day").eq("id", 1).maybeSingle(),
    db.from("books").select("id, slug, name_hu"),
    knownDayIdx != null ? Promise.resolve(knownDayIdx) : currentDayIndex(db),
  ]);
  const dailyBudget = settingsRow?.daily_budget_minutes ?? DEFAULT_DAILY_BUDGET_MINUTES;
  const newCardsPerDay = settingsRow?.new_cards_per_day ?? DEFAULT_NEW_CARDS_PER_DAY;
  const budget = mode === "short" ? Math.min(SHORT_SESSION_MINUTES, dailyBudget) : dailyBudget;

  const bookBySlug = new Map((booksRows ?? []).map((b) => [b.slug, b.id]));
  const bookById = new Map((booksRows ?? []).map((b) => [b.id, b]));

  // Wave 2: the plan window, due cards and weak books — independent of each other.
  const [{ data: planRows }, { data: dueRows }, { data: weakScopes }] = await Promise.all([
    db
      .from("reading_plan")
      .select("day_idx, segments, focus_note")
      .gte("day_idx", Math.max(1, dayIdx - RECENT_READING_DAYS))
      .lte("day_idx", dayIdx)
      .order("day_idx"),
    mode === "reading_only"
      ? Promise.resolve({ data: null })
      : db
          .from("card_states")
          .select("card_id, stability, lapses, due_at, state, cards!inner(type, active)")
          .lte("due_at", now.toISOString())
          .gt("state", 0)
          .eq("suspended", false)
          .eq("cards.active", true)
          .in("cards.type", [...SRS_CARD_TYPES])
          .order("due_at", { ascending: true })
          .limit(400),
    mode === "reading_only"
      ? Promise.resolve({ data: null })
      : db.from("mastery").select("scope_type, scope_id, score, card_count").eq("scope_type", "book").gte("card_count", 10).order("score", { ascending: true }).limit(2),
  ]);

  const todayPlan = (planRows ?? []).find((p) => p.day_idx === dayIdx) ?? null;
  const todaysChapters = todayPlan ? expandSegments(todayPlan.segments, bookBySlug) : [];
  const recentChapters = (planRows ?? []).filter((p) => p.day_idx !== dayIdx).flatMap((p) => expandSegments(p.segments, bookBySlug));

  const blocks: SessionBlock[] = [];
  let remaining = budget;

  // 1. READING ---------------------------------------------------------------
  if (todayPlan && todaysChapters.length) {
    const verseCount = await verseCountForChapters(db, todaysChapters);
    const readingMinutesFull = estimateReadingMinutes(verseCount);
    const readingReserved = Math.min(readingMinutesFull, budget * 0.5);
    const seg = todayPlan.segments[0];
    const book = bookById.get(bookBySlug.get(seg.book_slug) ?? -1);
    blocks.push({
      type: "reading",
      items: [],
      reading: {
        book_slug: seg.book_slug,
        book_name: book?.name_hu ?? seg.book_slug,
        ch_from: seg.ch_from,
        ch_to: todayPlan.segments[todayPlan.segments.length - 1].ch_to,
        focus_note: todayPlan.focus_note,
      },
      est_minutes: Math.round(readingMinutesFull),
      label: "Olvasás",
    });
    remaining -= readingReserved;
  }

  if (mode === "reading_only") {
    return { day_idx: dayIdx, blocks, total_est: blocks.reduce((s, b) => s + b.est_minutes, 0) };
  }

  // 2. DUE REVIEW (up to 60% of what's left) --------------------------------
  type DueRow = { card_id: number; stability: number | null; lapses: number; due_at: string; cards: { type: string } | null };
  const due = (dueRows ?? []) as unknown as DueRow[];

  const scored = due.map((r) => {
    const daysOverdue = Math.max(0, (now.getTime() - new Date(r.due_at).getTime()) / 86_400_000);
    const priority = r.lapses * 2.0 + (1 / ((r.stability ?? 0) + 1)) * 3.0 + daysOverdue * 0.5;
    return { ...r, priority, type: (r.cards?.type ?? "question") as CardType };
  });
  scored.sort((a, b) => b.priority - a.priority);

  const reviewBudget = remaining * 0.6;
  const reviewItems: number[] = [];
  let reviewMinutes = 0;
  for (const r of scored) {
    const cost = estimateCardMinutes(r.type);
    if (reviewMinutes + cost > reviewBudget && reviewItems.length > 0) break;
    reviewItems.push(r.card_id);
    reviewMinutes += cost;
  }
  if (reviewItems.length) {
    blocks.push({ type: "review", items: reviewItems.map((card_id) => ({ card_id })), est_minutes: Math.round(reviewMinutes), label: "Ismétlés" });
  }

  // 3. NEW CARDS — from the chapters just read, in reading order -------------
  // Avalanche protection: no new material while a big review backlog exists.
  const newBudget = due.length > 120 ? 0 : remaining * 0.3;
  const newItems: number[] = [];
  if (newBudget > 0 && newCardsPerDay > 0) {
    type NewRow = { id: number; type: string; book_id: number | null; chapter: number | null };
    const seen = new Set<number>();
    let newMinutes = 0;
    const takeFrom = (rows: NewRow[]) => {
      for (const c of rows) {
        if (newItems.length >= newCardsPerDay) return;
        if (seen.has(c.id)) continue;
        const cost = estimateCardMinutes(c.type as CardType);
        if (newMinutes + cost > newBudget && newItems.length > 0) return;
        seen.add(c.id);
        newItems.push(c.id);
        newMinutes += cost;
      }
    };

    // (a) today's and the previous two days' chapters: one query per book,
    // then ordered by the reading order of the chapters.
    const recent = [...todaysChapters, ...recentChapters];
    const chapterRank = new Map(recent.map((c, i) => [`${c.book_id}:${c.chapter}`, i]));
    const perBook = await Promise.all(
      Array.from(chaptersByBook(recent)).map(async ([bookId, chs]) => {
        const { data } = await db
          .from("cards")
          .select("id, type, book_id, chapter, difficulty, card_states!inner(state, suspended)")
          .eq("active", true)
          .eq("book_id", bookId)
          .in("chapter", chs)
          .in("type", [...SRS_CARD_TYPES])
          .eq("card_states.state", 0)
          .eq("card_states.suspended", false)
          .order("difficulty", { ascending: true })
          .limit(120);
        return (data ?? []) as NewRow[];
      }),
    );
    const recentRows = perBook.flat().sort((a, b) => (chapterRank.get(`${a.book_id}:${a.chapter}`) ?? 1e9) - (chapterRank.get(`${b.book_id}:${b.chapter}`) ?? 1e9));
    takeFrom(recentRows);

    // (b) fallback in canonical reading order, so nothing ever jumps ahead
    // of where the plan is.
    if (newItems.length < newCardsPerDay) {
      const { data: rest } = await db
        .from("cards")
        .select("id, type, book_id, chapter, card_states!inner(state, suspended)")
        .eq("active", true)
        .in("type", [...SRS_CARD_TYPES])
        .eq("card_states.state", 0)
        .eq("card_states.suspended", false)
        .order("book_id", { ascending: true })
        .order("chapter", { ascending: true })
        .order("id", { ascending: true })
        .limit(60);
      takeFrom((rest ?? []) as NewRow[]);
    }

    if (newItems.length) {
      blocks.push({ type: "new", items: newItems.map((card_id) => ({ card_id })), est_minutes: Math.round(newMinutes), label: "Új kérdések" });
    }
  }

  // 4. WEAK POINTS (10% of remaining) ---------------------------------------
  const weakBudget = remaining * 0.1;
  if (weakScopes?.length && weakBudget > 1) {
    const already = new Set([...reviewItems, ...newItems]);
    const weakItems: number[] = [];
    let weakMinutes = 0;
    const bookIds = weakScopes.map((s) => bookBySlug.get(s.scope_id)).filter((id): id is number => id != null);
    const perBook = await Promise.all(
      bookIds.map((bookId) =>
        db
          .from("cards")
          .select("id, type, card_states!inner(lapses, stability, state, suspended)")
          .eq("active", true)
          .eq("book_id", bookId)
          .in("type", [...SRS_CARD_TYPES])
          .gt("card_states.state", 0)
          .eq("card_states.suspended", false)
          .or("lapses.gt.0,stability.lt.7", { referencedTable: "card_states" })
          .limit(20),
      ),
    );
    for (const { data: weakCards } of perBook) {
      if (weakMinutes >= weakBudget) break;
      for (const c of (weakCards ?? []) as { id: number; type: string }[]) {
        if (already.has(c.id)) continue;
        const cost = estimateCardMinutes(c.type as CardType);
        if (weakMinutes + cost > weakBudget) break;
        weakItems.push(c.id);
        already.add(c.id);
        weakMinutes += cost;
      }
    }
    if (weakItems.length) {
      blocks.push({ type: "weak", items: weakItems.map((card_id) => ({ card_id })), est_minutes: Math.round(weakMinutes), label: "Gyenge pontok" });
    }
  }

  // 5. GAME (the rest, capped) ---------------------------------------------
  const usedSoFar = blocks.reduce((s, b) => s + b.est_minutes, 0);
  const gameBudget = Math.min(8, Math.max(0, budget - usedSoFar));
  if (gameBudget >= 2) {
    const game = pickGame(dayIdx, await availableGames(db));
    if (game) blocks.push({ type: "game", items: [], game: { game }, est_minutes: Math.round(gameBudget), label: "Játék" });
  }

  return { day_idx: dayIdx, blocks, total_est: Math.round(blocks.reduce((s, b) => s + b.est_minutes, 0)) };
}
