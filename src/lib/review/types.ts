import type { CardType } from "@/lib/content/difficulty";
import type { PersistedCardState } from "@/lib/fsrs/engine";
import type { McqPayload, ClozePayload, LocatePayload, NumericPayload, VersePayload, QuestionPayload } from "@/lib/content/card-payloads";

export interface ReviewCard {
  id: number;
  type: CardType;
  prompt: string;
  answer: string;
  answer_alt: string[];
  distractors: string[];
  payload: QuestionPayload | McqPayload | ClozePayload | LocatePayload | NumericPayload | VersePayload | Record<string, unknown> | null;
  verse_ref: string | null;
  entity_id: number | null;
  fact_id: number | null;
  book_id: number | null;
  chapter: number | null;
  state: PersistedCardState;
}
