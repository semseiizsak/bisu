export interface McqPayload {
  options: string[];
}

export type QuestionKind = "narrative" | "person" | "place" | "saying" | "number" | "theme";

export const QUESTION_KINDS: readonly QuestionKind[] = ["narrative", "person", "place", "saying", "number", "theme"];

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  narrative: "Történet",
  person: "Szereplő",
  place: "Helyszín",
  saying: "Mondás",
  number: "Szám",
  theme: "Üzenet",
};

/** Payload of a `question` card. `options` is the shuffled answer + 3
 * distractors of the same kind; `why` is the one-sentence explanation shown
 * after answering. */
export interface QuestionPayload {
  kind: QuestionKind;
  options: string[];
  why: string;
}
export interface NumericPayload {
  unit: string | null;
}
export interface ClozePayload {
  full_verse: string;
}
export interface OrderPayload {
  items: { id: number; label: string }[];
  correct_order: number[];
}
export interface LocatePayload {
  verse_text: string;
  book_id: number;
  chapter: number;
}
export interface ChainPayload {
  line: string;
  direction: "parent" | "child";
}
export interface MapPayload {
  svg_x: number;
  svg_y: number;
  tolerance: number;
  place_type: string | null;
}
export interface VersePayload {
  text: string;
  reference: string;
  stage: 1 | 2 | 3;
}
