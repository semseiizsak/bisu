export type SessionBlockType = "reading" | "review" | "new" | "weak" | "game" | "interleave";

export interface SessionCardItem {
  card_id: number;
}

export interface ReadingBlockData {
  book_slug: string;
  book_name: string;
  ch_from: number;
  ch_to: number;
  focus_note: string | null;
}

export interface GameBlockData {
  game: string;
}

export interface SessionBlock {
  type: SessionBlockType;
  items: SessionCardItem[];
  reading?: ReadingBlockData;
  game?: GameBlockData;
  est_minutes: number;
  label: string;
}

export interface SessionPlan {
  day_idx: number | null;
  blocks: SessionBlock[];
  total_est: number;
}

export type SessionMode = "full" | "short" | "reading_only";
