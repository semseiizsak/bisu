import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { SRS_CARD_TYPES, type CardType } from "@/lib/content/difficulty";
import { estimateCardMinutes, estimateReadingMinutes } from "@/lib/session/time-estimates";
import type { SessionBlock, SessionPlan, SessionMode } from "@/lib/session/types";
import { currentDayIndex } from "@/lib/session/current-day";
import { DEFAULT_DAILY_BUDGET_MINUTES, DEFAULT_NEW_CARDS_PER_DAY, SHORT_SESSION_MINUTES } from "@/lib/session/constants";

type DB = SupabaseClient<Database>;

const GAME_ROTATION = ["locate", "timeline", "numbers", "chain", "who-said", "map", "boss"] as const;

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

async function verseCountForChapters(db: DB, chapters: ChapterRef[]): Promise<number> {
  let total = 0;
  for (const c of chapters) {
    const { count } = await db.from("verses").select("id", { count: "exact", head: true }).eq("book_id", c.book_id).eq("chapter", c.chapter);
    total += count ?? 0;
  }
  return total;
}

/**
 * Builds the day's plan: reading (from the plan), due reviews, new cards
 * from the chapters just read, a weak-spot block and the day's game.
 *
 * Only the quiz card types (question / manual recall / memorized verse)
 * ever enter the quiz blocks; locate / order / chain / map cards belong
 * to the games and are never mixed in.
 */
export async function buildSessionPlan(db: DB, now: Date = new Date(), mode: SessionMode = "full"): Promise<SessionPlan> {
  const { data: settingsRow } = await db.from("settings").select("daily_budget_minutes, new_cards_per_day").eq("id", 1).maybeSingle();
  const dailyBudget = settingsRow?.daily_budget_minutes ?? DEFAULT_DAILY_BUDGET_MINUTES;
  const newCardsPerDay = settingsRow?.new_cards_per_day ?? DEFAULT_NEW_CARDS_PER_DAY;

  const budget = mode === "short" ? Math.min(SHORT_SESSION_MINUTES, dailyBudget) : dailyBudget;
  const dayIdx = await currentDayIndex(db);

  const { data: booksRows } = await db.from("books").select("id, slug, name_hu");
  const bookBySlug = new Map((booksRows ?? []).map((b) => [b.slug, b.id]));
  const bookById = new Map((booksRows ?? []).map((b) => [b.id, b]));

  const blocks: SessionBlock[] = [];
  let remaining = budget;

  // 1. READING ---------------------------------------------------------------
  const { data: planRows } = await db
    .from("reading_plan")
    .select("day_idx, segments, focus_note")
    .gte("day_idx", Math.max(1, dayIdx - RECENT_READING_DAYS))
    .lte("day_idx", dayIdx)
    .order("day_idx");
  const todayPlan = (planRows ?? []).find((p) => p.day_idx === dayIdx) ?? null;
  const todaysChapters = todayPlan ? expandSegments(todayPlan.segments, bookBySlug) : [];
  const recentChapters = (planRows ?? []).filter((p) => p.day_idx !== dayIdx).flatMap((p) => expandSegments(p.segments, bookBySlug));

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
  // state = 0 means "never studied": those are paced through the NEW block.
  const { data: dueRows } = await db
    .from("card_states")
    .select("card_id, stability, lapses, due_at, state, cards!inner(type, active)")
    .lte("due_at", now.toISOString())
    .gt("state", 0)
    .eq("suspended", false)
    .eq("cards.active", true)
    .in("cards.type", [...SRS_CARD_TYPES])
    .order("due_at", { ascending: true })
    .limit(400);

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
  if (newBudget > 0 && newCardsPerDay > 0) {
    const newItems: number[] = [];
    const seen = new Set<number>();
    let newMinutes = 0;

    type NewRow = { id: number; type: string };
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

    const unstudiedInChapter = async (c: ChapterRef): Promise<NewRow[]> => {
      const { data } = await db
        .from("cards")
        .select("id, type, difficulty, card_states!inner(state, suspended)")
        .eq("active", true)
        .eq("book_id", c.book_id)
        .eq("chapter", c.chapter)
        .in("type", [...SRS_CARD_TYPES])
        .eq("card_states.state", 0)
        .eq("card_states.suspended", false)
        .order("difficulty", { ascending: true })
        .limit(40);
      return (data ?? []) as NewRow[];
    };

    // (a) today's chapters, (b) the previous two plan days — you review what
    // you just read, not a random slice of the corpus.
    for (const c of [...todaysChapters, ...recentChapters]) {
      if (newItems.length >= newCardsPerDay) break;
      takeFrom(await unstudiedInChapter(c));
    }

    // (c) fallback in canonical reading order, so nothing ever jumps ahead
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
  const { data: weakScopes } = await db
    .from("mastery")
    .select("scope_type, scope_id, score, card_count")
    .eq("scope_type", "book")
    .gte("card_count", 10)
    .order("score", { ascending: true })
    .limit(2);

  if (weakScopes?.length && weakBudget > 1) {
    const weakItems: number[] = [];
    const already = new Set([...reviewItems, ...blocks.filter((b) => b.type === "new").flatMap((b) => b.items.map((i) => i.card_id))]);
    let weakMinutes = 0;
    for (const scope of weakScopes) {
      if (weakMinutes >= weakBudget) break;
      const bookId = bookBySlug.get(scope.scope_id);
      if (!bookId) continue;
      const { data: weakCards } = await db
        .from("cards")
        .select("id, type, card_states!inner(lapses, stability, state, suspended)")
        .eq("active", true)
        .eq("book_id", bookId)
        .in("type", [...SRS_CARD_TYPES])
        .gt("card_states.state", 0)
        .eq("card_states.suspended", false)
        .or("lapses.gt.0,stability.lt.7", { referencedTable: "card_states" })
        .limit(20);
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
    const game = GAME_ROTATION[(dayIdx - 1) % GAME_ROTATION.length];
    blocks.push({ type: "game", items: [], game: { game }, est_minutes: Math.round(gameBudget), label: "Játék" });
  }

  return { day_idx: dayIdx, blocks, total_est: Math.round(blocks.reduce((s, b) => s + b.est_minutes, 0)) };
}
