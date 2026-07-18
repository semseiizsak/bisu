import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { CardType } from "@/lib/content/difficulty";
import { estimateCardMinutes, estimateReadingMinutes } from "@/lib/session/time-estimates";
import { BOOKS } from "@/lib/content/books";
import type { SessionBlock, SessionPlan, SessionMode } from "@/lib/session/types";
import { dayIndexForDate } from "@/lib/session/day-index";

type DB = SupabaseClient<Database>;

const GAME_ROTATION = ["locate", "timeline", "numbers", "chain", "who-said", "map", "boss"] as const;

async function verseCountForSegments(
  db: DB,
  bookBySlug: Map<string, number>,
  segments: { book_slug: string; ch_from: number; ch_to: number }[],
): Promise<number> {
  let total = 0;
  for (const seg of segments) {
    const bookId = bookBySlug.get(seg.book_slug);
    if (!bookId) continue;
    const { count } = await db
      .from("verses")
      .select("id", { count: "exact", head: true })
      .eq("book_id", bookId)
      .gte("chapter", seg.ch_from)
      .lte("chapter", seg.ch_to);
    total += count ?? 0;
  }
  return total;
}

export async function buildSessionPlan(db: DB, now: Date = new Date(), mode: SessionMode = "full"): Promise<SessionPlan> {
  const { data: settingsRow } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
  const settings = settingsRow ?? {
    daily_budget_minutes: 90,
    new_cards_per_day: 30,
    reading_speed_wpm: 200,
    program_start_date: now.toISOString().slice(0, 10),
    timezone: "Europe/Budapest",
    id: 1,
  };

  const budget = mode === "short" ? Math.min(15, settings.daily_budget_minutes) : settings.daily_budget_minutes;
  const dayIdx = dayIndexForDate(settings.program_start_date, now);

  const { data: booksRows } = await db.from("books").select("id, slug, name_hu");
  const bookBySlug = new Map((booksRows ?? []).map((b) => [b.slug, b.id]));
  const bookById = new Map((booksRows ?? []).map((b) => [b.id, b]));

  const blocks: SessionBlock[] = [];
  let remaining = budget;

  // 1. READING RESERVATION -------------------------------------------------
  const { data: planRow } = await db.from("reading_plan").select("*").eq("day_idx", dayIdx).maybeSingle();
  const todaysBooksChapters: { book_id: number; chapter: number }[] = [];

  if (planRow) {
    const verseCount = await verseCountForSegments(db, bookBySlug, planRow.segments);
    const readingMinutesFull = estimateReadingMinutes(verseCount);
    const readingReserved = Math.min(readingMinutesFull, budget * 0.45);

    for (const seg of planRow.segments) {
      const bookId = bookBySlug.get(seg.book_slug);
      if (!bookId) continue;
      for (let ch = seg.ch_from; ch <= seg.ch_to; ch++) todaysBooksChapters.push({ book_id: bookId, chapter: ch });
    }

    if (mode !== "reading_only" || planRow.segments.length > 0) {
      const seg = planRow.segments[0];
      const book = seg ? bookById.get(bookBySlug.get(seg.book_slug) ?? -1) : undefined;
      blocks.push({
        type: "reading",
        items: [],
        reading: seg
          ? {
              book_slug: seg.book_slug,
              book_name: book?.name_hu ?? seg.book_slug,
              ch_from: seg.ch_from,
              ch_to: planRow.segments[planRow.segments.length - 1].ch_to,
              focus_note: planRow.focus_note,
            }
          : undefined,
        est_minutes: Math.round(readingMinutesFull),
        label: "Olvasás",
      });
    }
    remaining -= readingReserved;
  }

  if (mode === "reading_only") {
    return { day_idx: dayIdx, blocks, total_est: blocks.reduce((s, b) => s + b.est_minutes, 0) };
  }

  // 2. DUE REVIEW (55% of remaining) ---------------------------------------
  const { data: dueRows } = await db
    .from("card_states")
    .select("card_id, stability, lapses, due_at, state, cards!inner(type, entity_id, entities(importance))")
    .lte("due_at", now.toISOString())
    .eq("suspended", false)
    .order("due_at", { ascending: true })
    .limit(400);

  type DueRow = {
    card_id: number;
    stability: number | null;
    lapses: number;
    due_at: string;
    cards: { type: string; entity_id: number | null; entities: { importance: number } | null } | null;
  };
  const due = (dueRows ?? []) as unknown as DueRow[];

  const scored = due.map((r) => {
    const daysOverdue = Math.max(0, (now.getTime() - new Date(r.due_at).getTime()) / 86_400_000);
    const importanceBoost = (r.cards?.entities?.importance ?? 0) >= 4 ? 1.0 : 0;
    const priority = r.lapses * 2.0 + (1 / ((r.stability ?? 0) + 1)) * 3.0 + daysOverdue * 0.5 + importanceBoost;
    return { ...r, priority, type: (r.cards?.type ?? "recall") as CardType };
  });
  scored.sort((a, b) => b.priority - a.priority);

  const reviewBudget = remaining * 0.55;
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

  // 3. NEW CARDS (20% of remaining, avalanche protection) ------------------
  const newBudget = due.length > 150 ? 0 : remaining * 0.2;
  if (newBudget > 0) {
    const todaysChapterIds = todaysBooksChapters.map((c) => `(${c.book_id},${c.chapter})`);
    const newCardsQuery = db
      .from("cards")
      .select("id, type, book_id, chapter, card_states!inner(state)")
      .eq("active", true)
      .eq("card_states.state", 0)
      .limit(200);

    const { data: candidateRows } = await newCardsQuery;
    type NewCandidateRow = { id: number; type: string; book_id: number | null; chapter: number | null };
    const candidates = (candidateRows ?? []) as NewCandidateRow[];

    const todaySet = new Set(todaysChapterIds);
    candidates.sort((a, b) => {
      const aToday = todaySet.has(`(${a.book_id},${a.chapter})`) ? 1 : 0;
      const bToday = todaySet.has(`(${b.book_id},${b.chapter})`) ? 1 : 0;
      return bToday - aToday;
    });

    const newItems: number[] = [];
    let newMinutes = 0;
    const maxNew = settings.new_cards_per_day;
    for (const c of candidates) {
      if (newItems.length >= maxNew) break;
      const cost = estimateCardMinutes(c.type as CardType);
      if (newMinutes + cost > newBudget && newItems.length > 0) break;
      newItems.push(c.id);
      newMinutes += cost;
    }
    if (newItems.length) {
      blocks.push({ type: "new", items: newItems.map((card_id) => ({ card_id })), est_minutes: Math.round(newMinutes), label: "Új kártyák" });
    }
  }

  // 4. WEAK POINTS (12% of remaining) ---------------------------------------
  const weakBudget = remaining * 0.12;
  const { data: weakScopes } = await db
    .from("mastery")
    .select("scope_type, scope_id, score, card_count")
    .gte("card_count", 10)
    .order("score", { ascending: true })
    .limit(3);

  if (weakScopes?.length) {
    const weakItems: number[] = [];
    let weakMinutes = 0;
    for (const scope of weakScopes) {
      if (weakMinutes >= weakBudget) break;
      let query = db
        .from("cards")
        .select("id, type, card_states!inner(lapses, stability)")
        .eq("active", true)
        .or("card_states.lapses.gt.0,card_states.stability.lt.7")
        .limit(20);

      if (scope.scope_type === "book") {
        const bookId = bookBySlug.get(scope.scope_id);
        if (bookId) query = query.eq("book_id", bookId);
      } else if (scope.scope_type === "entity") {
        const entityId = Number(scope.scope_id.split(":")[1]);
        if (entityId) query = query.eq("entity_id", entityId);
      }

      const { data: weakCards } = await query;
      for (const c of (weakCards ?? []) as { id: number; type: string }[]) {
        const cost = estimateCardMinutes(c.type as CardType);
        if (weakMinutes + cost > weakBudget) break;
        weakItems.push(c.id);
        weakMinutes += cost;
      }
    }
    if (weakItems.length) {
      blocks.push({ type: "weak", items: weakItems.map((card_id) => ({ card_id })), est_minutes: Math.round(weakMinutes), label: "Gyenge pontok" });
    }
  }

  // 5. GAME (13% of remaining) ----------------------------------------------
  const gameBudget = remaining * 0.13;
  if (gameBudget > 1) {
    const game = GAME_ROTATION[(dayIdx - 1) % 7];
    blocks.push({ type: "game", items: [], game: { game }, est_minutes: Math.round(gameBudget), label: "Játék" });
  }

  // 6. INTERLEAVING (remainder) ----------------------------------------------
  const usedSoFar = blocks.reduce((s, b) => s + b.est_minutes, 0);
  const interleaveBudget = Math.max(0, budget - usedSoFar);
  if (interleaveBudget > 1) {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
    const { data: recentBookIds } = await db.from("reviews").select("cards(book_id)").gte("reviewed_at", thirtyDaysAgo).limit(500);
    const touchedBookIds = new Set(
      ((recentBookIds ?? []) as unknown as { cards: { book_id: number | null } | null }[])
        .map((r) => r.cards?.book_id)
        .filter((id): id is number => id != null),
    );
    const untouchedSlugs = BOOKS.filter((b) => {
      const id = bookBySlug.get(b.slug);
      return id != null && !touchedBookIds.has(id);
    }).map((b) => bookBySlug.get(b.slug)!);

    if (untouchedSlugs.length) {
      const { data: interleaveCards } = await db
        .from("cards")
        .select("id, type")
        .eq("active", true)
        .in("book_id", untouchedSlugs.slice(0, 10))
        .limit(10);
      const items = (interleaveCards ?? []).slice(0, 8).map((c) => ({ card_id: c.id }));
      if (items.length) {
        blocks.push({ type: "interleave", items, est_minutes: interleaveBudget, label: "Felfrissítés" });
      }
    }
  }

  return { day_idx: dayIdx, blocks, total_est: Math.round(blocks.reduce((s, b) => s + b.est_minutes, 0)) };
}
