import Dexie, { type EntityTable } from "dexie";

export interface LocalCard {
  id: number;
  book_id: number | null;
  entity_id: number | null;
  type: string;
  prompt: string;
  answer: string;
  answer_alt: string[];
  distractors: string[];
  payload: unknown;
  chapter: number | null;
  verse_ref: string | null;
  difficulty: number;
  tags: string[];
}

export interface LocalCardState {
  card_id: number;
  stability: number | null;
  difficulty: number | null;
  due_at: string | null;
  last_review: string | null;
  reps: number;
  lapses: number;
  state: number;
  suspended: boolean;
}

export interface PendingReview {
  local_id?: number;
  card_id: number;
  rating: number;
  state_before: number | null;
  elapsed_days: number | null;
  duration_ms: number;
  mode: string;
  reviewed_at: string;
  new_stability: number;
  new_difficulty: number;
  new_due_at: string;
  new_state: number;
  new_reps: number;
  new_lapses: number;
  synced: 0 | 1;
}

export interface LocalVerse {
  id: number;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

class BibliaDB extends Dexie {
  cards!: EntityTable<LocalCard, "id">;
  card_states!: EntityTable<LocalCardState, "card_id">;
  pending_reviews!: EntityTable<PendingReview, "local_id">;
  verses!: EntityTable<LocalVerse, "id">;
  meta!: EntityTable<MetaEntry, "key">;

  constructor() {
    super("biblia-mastery");
    this.version(1).stores({
      cards: "id, book_id, entity_id, type, [book_id+chapter]",
      card_states: "card_id, due_at, suspended",
      pending_reviews: "++local_id, card_id, reviewed_at, synced",
      verses: "id, [book_id+chapter]",
      meta: "key",
    });
  }
}

export const db = new BibliaDB();
