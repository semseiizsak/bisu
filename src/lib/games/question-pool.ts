import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { PersistedCardState } from "@/lib/fsrs/engine";
import type { QuestionKind, QuestionPayload } from "@/lib/content/card-payloads";

type DB = SupabaseClient<Database>;

export interface GameQuestion {
  id: number;
  prompt: string;
  answer: string;
  options: string[];
  state: PersistedCardState;
}

const EMPTY_STATE: PersistedCardState = { stability: null, difficulty: null, due_at: null, last_review: null, reps: 0, lapses: 0, state: 0 };

/**
 * Random sample of question cards for the quiz-shaped games. Draws only
 * from chapters the learner has already studied (a card that has been
 * seen at least once), falling back to any active card when the deck is
 * still young — the games are for replaying what you know, not for
 * ambushing you with chapters you haven't read.
 */
export async function loadGameQuestions(
  db: DB,
  opts: { kind?: QuestionKind; bookId?: number; count: number },
): Promise<GameQuestion[]> {
  let query = db
    .from("cards")
    .select("id, prompt, answer, payload, card_states!inner(stability, difficulty, due_at, last_review, reps, lapses, state, suspended)")
    .eq("type", "question")
    .eq("active", true)
    .eq("card_states.suspended", false)
    .limit(300);
  if (opts.kind) query = query.eq("kind", opts.kind);
  if (opts.bookId != null) query = query.eq("book_id", opts.bookId);

  const { data } = await query;
  type Row = {
    id: number;
    prompt: string;
    answer: string;
    payload: QuestionPayload | null;
    card_states: PersistedCardState & { suspended: boolean } | (PersistedCardState & { suspended: boolean })[] | null;
  };
  const rows = ((data ?? []) as unknown as Row[]).map((r) => {
    const s = Array.isArray(r.card_states) ? r.card_states[0] : r.card_states;
    return { ...r, state: s ? { ...s } : EMPTY_STATE };
  });

  const studied = rows.filter((r) => r.state.reps > 0);
  const pool = studied.length >= opts.count ? studied : rows;
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, opts.count);

  return shuffled
    .map((r) => ({
      id: r.id,
      prompt: r.prompt,
      answer: r.answer,
      options: Array.from(new Set(r.payload?.options ?? [])),
      state: r.state,
    }))
    .filter((q) => q.options.length >= 2);
}
