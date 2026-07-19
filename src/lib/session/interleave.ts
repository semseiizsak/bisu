import type { ReviewCard } from "@/lib/review/types";
import type { McqPayload } from "@/lib/content/card-payloads";

/** How a card will be presented in the daily quiz — used both for variety
 * constraints (no long same-format runs) and for on-the-fly MCQ synthesis. */
export type Presentation = "mcq" | "numeric" | "typed" | "reveal";

const LONG_ANSWER = 24; // mirrors CardFace's typed-vs-reveal threshold
const TEXT_TYPES = new Set(["recall", "reverse", "chain", "cloze", "locate"]);

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const isNumericAnswer = (a: string) => /^\d+([.,]\d+)?$/.test(a.trim());

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function basePresentation(card: ReviewCard): Presentation {
  if (card.type === "mcq") return "mcq";
  if (card.type === "numeric") return "numeric";
  if (TEXT_TYPES.has(card.type)) return card.answer.length > LONG_ANSWER ? "reveal" : "typed";
  return "reveal";
}

/**
 * Synthesizes MCQ options for a typed-answer card from the other answers in
 * the same session. The pool is topically coherent (same day, same books),
 * candidates are constrained to the same kind of answer (numeric vs name),
 * deduped by folded text, and the pick is deterministic per card id.
 * Returns null when fewer than 3 plausible distractors exist.
 */
export function synthesizeOptions(card: ReviewCard, pool: ReviewCard[]): string[] | null {
  const answer = card.answer.trim();
  if (answer.length > LONG_ANSWER) return null;
  const numeric = isNumericAnswer(answer);
  const own = fold(answer);

  const seen = new Set<string>([own]);
  let candidates: string[] = [];
  for (const other of pool) {
    if (other.id === card.id) continue;
    const a = other.answer.trim();
    if (!a || a.length > LONG_ANSWER) continue;
    if (isNumericAnswer(a) !== numeric) continue;
    const f = fold(a);
    if (seen.has(f)) continue;
    seen.add(f);
    candidates.push(a);
  }
  if (candidates.length < 3) return null;

  // Prefer answers sharing the unit word ("600 esztendő" gets other
  // esztendő values, not "15 sing") when enough of them exist.
  const lastWord = (s: string) => fold(s.split(/\s+/).at(-1) ?? "");
  const unit = lastWord(answer);
  if (unit && !/^\d/.test(unit)) {
    const sameUnit = candidates.filter((c) => lastWord(c) === unit);
    if (sameUnit.length >= 3) candidates = sameUnit;
  }

  const picked: string[] = [];
  const available = [...candidates];
  for (let i = 0; picked.length < 3 && available.length > 0; i++) {
    const idx = Math.floor(seededRandom(card.id * 31 + i) * available.length);
    picked.push(available.splice(idx, 1)[0]);
  }

  const options = [answer, ...picked];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(card.id * 17 + i) * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

/**
 * Builds the per-card presentation plan for a session: real MCQ cards keep
 * their options; roughly half of the eligible typed cards (deterministic by
 * id parity) get synthesized options so the quiz alternates between choosing
 * and recalling instead of being typing all the way down.
 */
export function buildMcqOptionsByCard(cards: ReviewCard[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const card of cards) {
    if (card.type === "mcq") {
      const options = (card.payload as McqPayload | null)?.options;
      if (options?.length) map.set(card.id, Array.from(new Set(options)));
      continue;
    }
    if (basePresentation(card) !== "typed" || card.id % 2 !== 0) continue;
    const synthesized = synthesizeOptions(card, cards);
    if (synthesized) map.set(card.id, synthesized);
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
  if (cur.entity_id != null && cur.entity_id === prev.entity_id) return true;
  if (fold(cur.answer) === fold(prev.answer)) return true;
  // no more than 3 of the same presentation in a row
  if (i >= 3) {
    const p = presentations[i];
    if (presentations[i - 1] === p && presentations[i - 2] === p && presentations[i - 3] === p) return true;
  }
  return false;
}

/**
 * Greedy reorder so consecutive cards never share an entity or an answer,
 * and no presentation format runs longer than 3 — same-fact clusters showing
 * up back to back ("ugyanazok a válaszok egymás után") was one of the
 * owner's core complaints.
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
