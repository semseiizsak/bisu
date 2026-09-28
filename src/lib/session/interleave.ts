import type { ReviewCard } from "@/lib/review/types";
import type { McqPayload, QuestionPayload } from "@/lib/content/card-payloads";

/** How a card will be presented in the quiz. */
export type Presentation = "mcq" | "typed" | "reveal";

const LONG_ANSWER = 28; // mirrors CardFace's typed-vs-reveal threshold
const TEXT_TYPES = new Set(["recall", "chain", "cloze", "locate"]);

/** A question card is a "choose" card until it has been answered correctly
 * twice; after that it becomes a "recall" card. Recognition first, then
 * production — instead of typing exact abbreviations from day one. */
const MCQ_UNTIL_REPS = 2;

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

export function questionOptions(card: ReviewCard): string[] | null {
  if (card.type === "question") {
    const options = (card.payload as QuestionPayload | null)?.options;
    if (options?.length) return Array.from(new Set(options));
    if (card.distractors.length >= 3) return [card.answer, ...card.distractors];
    return null;
  }
  if (card.type === "mcq") {
    const options = (card.payload as McqPayload | null)?.options;
    return options?.length ? Array.from(new Set(options)) : null;
  }
  return null;
}

export function basePresentation(card: ReviewCard): Presentation {
  if (card.type === "question") {
    const knowsIt = card.state.reps >= MCQ_UNTIL_REPS && card.state.lapses === 0 && (card.state.stability ?? 0) >= 3;
    if (!knowsIt && questionOptions(card)) return "mcq";
    return card.answer.length > LONG_ANSWER ? "reveal" : "typed";
  }
  if (card.type === "mcq") return "mcq";
  if (TEXT_TYPES.has(card.type)) return card.answer.length > LONG_ANSWER ? "reveal" : "typed";
  return "reveal";
}

/**
 * Per-card presentation plan for a session: which cards get options. Only
 * cards that carry real, same-kind distractors are ever shown as multiple
 * choice — the old "synthesize options from the other cards' answers"
 * trick produced options like "600 esztendő / Éva / Nód földe".
 */
export function buildMcqOptionsByCard(cards: ReviewCard[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const card of cards) {
    if (basePresentation(card) !== "mcq") continue;
    const options = questionOptions(card);
    if (options) map.set(card.id, options);
  }
  return map;
}

export function effectivePresentation(card: ReviewCard, mcqOptionsByCard: Map<number, string[]>): Presentation {
  if (mcqOptionsByCard.has(card.id)) return "mcq";
  return basePresentation(card);
}

function conflictsAt(cards: ReviewCard[], i: number, presentations: Presentation[]): boolean {
  if (i === 0) return false;
  const cur = cards[i];
  const prev = cards[i - 1];
  if (cur.book_id != null && cur.book_id === prev.book_id && cur.chapter != null && cur.chapter === prev.chapter) return true;
  if (fold(cur.answer) === fold(prev.answer)) return true;
  // no more than 3 of the same presentation in a row
  if (i >= 3) {
    const p = presentations[i];
    if (presentations[i - 1] === p && presentations[i - 2] === p && presentations[i - 3] === p) return true;
  }
  return false;
}

/**
 * Greedy reorder so consecutive cards never come from the same chapter or
 * share an answer, and no presentation format runs longer than 3.
 */
export function interleaveCards(cards: ReviewCard[], mcqOptionsByCard: Map<number, string[]>): ReviewCard[] {
  const out = [...cards];
  const pres = () => out.map((c) => effectivePresentation(c, mcqOptionsByCard));
  for (let i = 1; i < out.length; i++) {
    if (!conflictsAt(out, i, pres())) continue;
    for (let j = i + 1; j < out.length; j++) {
      [out[i], out[j]] = [out[j], out[i]];
      if (!conflictsAt(out, i, pres())) break;
      [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}
