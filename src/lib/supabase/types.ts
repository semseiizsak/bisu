// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript` once the CLI is linked,
// if you'd rather not hand-maintain this.

type Table<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

type BooksRow = {
  id: number;
  slug: string;
  name_hu: string;
  short_hu: string;
  testament: "OT" | "NT";
  order_idx: number;
  genre: string;
  chapters_count: number;
};

type VersesRow = { id: number; book_id: number; chapter: number; verse: number; text: string };

type EntitiesRow = {
  id: number;
  type: string;
  name_hu: string;
  aliases: string[];
  summary: string | null;
  first_ref: string | null;
  ref_count: number;
  importance: number;
};

type FactsRow = {
  id: number;
  entity_id: number | null;
  fact_key: string;
  fact_value: string;
  numeric_val: number | null;
  unit: string | null;
  verse_ref: string;
  book_id: number | null;
  chapter: number | null;
  difficulty: number;
  confidence: number;
  verified: boolean;
  suppressed: boolean;
  tags: string[];
};

type SuppressedFactKeysRow = { fact_key: string; created_at: string };

type TimelineEventsRow = {
  id: number;
  label_hu: string;
  era: string;
  order_idx: number;
  approx_year: string | null;
  verse_ref: string | null;
  importance: number;
};

type GenealogyEdgesRow = {
  id: number;
  parent_id: number | null;
  child_id: number | null;
  line: string | null;
  verse_ref: string | null;
  order_in_line: number | null;
};

type GeoPlacesRow = {
  id: number;
  entity_id: number | null;
  svg_x: number;
  svg_y: number;
  place_type: string | null;
  tolerance: number;
};

type CardsRow = {
  id: number;
  type: string;
  prompt: string;
  prompt_raw: string | null;
  prompt_polished_at: string | null;
  answer: string;
  answer_alt: string[];
  distractors: string[];
  payload: Record<string, unknown> | null;
  fact_id: number | null;
  entity_id: number | null;
  book_id: number | null;
  chapter: number | null;
  verse_ref: string | null;
  difficulty: number;
  tags: string[];
  variant_of: number | null;
  source: string;
  active: boolean;
  created_at: string;
};

type CardStatesRow = {
  card_id: number;
  stability: number | null;
  difficulty: number | null;
  due_at: string | null;
  last_review: string | null;
  reps: number;
  lapses: number;
  state: number;
  suspended: boolean;
};

type ReviewsRow = {
  id: number;
  card_id: number | null;
  rating: number;
  state_before: number | null;
  elapsed_days: number | null;
  duration_ms: number | null;
  mode: string | null;
  reviewed_at: string;
};

type ReadingPlanRow = {
  day_idx: number;
  phase: number;
  segments: { book_slug: string; ch_from: number; ch_to: number }[];
  est_minutes: number;
  focus_note: string | null;
};

type ReadingLogRow = { day_idx: number; completed_at: string | null; minutes: number | null; notes: string | null };

type MasteryRow = {
  scope_type: string;
  scope_id: string;
  coverage: number;
  retention: number;
  score: number;
  card_count: number;
  updated_at: string;
  boss_beaten_at: string | null;
};

type BadgesRow = {
  id: string;
  category: string;
  metric: string;
  label_hu: string;
  description_hu: string;
  threshold: number;
  earned_at: string | null;
  seen_at: string | null;
};

type DailySessionsRow = {
  date: string;
  budget_minutes: number;
  spent_minutes: number;
  reading_minutes: number;
  srs_minutes: number;
  game_minutes: number;
  cards_done: number;
  cards_correct: number;
  streak_kept: boolean;
  plan: Record<string, unknown> | null;
  completed: boolean;
};

type SettingsRow = {
  id: number;
  daily_budget_minutes: number;
  new_cards_per_day: number;
  reading_speed_wpm: number;
  timezone: string;
  program_start_date: string;
};

export interface Database {
  public: {
    Tables: {
      books: Table<BooksRow, Pick<BooksRow, "slug" | "name_hu" | "short_hu" | "testament" | "order_idx" | "genre" | "chapters_count"> & Partial<BooksRow>>;
      verses: Table<VersesRow, Pick<VersesRow, "book_id" | "chapter" | "verse" | "text"> & Partial<VersesRow>>;
      entities: Table<EntitiesRow, Pick<EntitiesRow, "type" | "name_hu"> & Partial<EntitiesRow>>;
      facts: Table<FactsRow, Pick<FactsRow, "fact_key" | "fact_value" | "verse_ref"> & Partial<FactsRow>>;
      timeline_events: Table<TimelineEventsRow, Pick<TimelineEventsRow, "label_hu" | "era" | "order_idx"> & Partial<TimelineEventsRow>>;
      genealogy_edges: Table<GenealogyEdgesRow, Partial<GenealogyEdgesRow>>;
      geo_places: Table<GeoPlacesRow, Pick<GeoPlacesRow, "svg_x" | "svg_y"> & Partial<GeoPlacesRow>>;
      cards: Table<CardsRow, Pick<CardsRow, "type" | "prompt" | "answer"> & Partial<CardsRow>>;
      card_states: Table<CardStatesRow, Pick<CardStatesRow, "card_id"> & Partial<CardStatesRow>>;
      reviews: Table<ReviewsRow, Pick<ReviewsRow, "rating"> & Partial<ReviewsRow>>;
      reading_plan: Table<ReadingPlanRow, Pick<ReadingPlanRow, "day_idx" | "phase" | "segments" | "est_minutes"> & Partial<ReadingPlanRow>>;
      reading_log: Table<ReadingLogRow, Pick<ReadingLogRow, "day_idx"> & Partial<ReadingLogRow>>;
      mastery: Table<MasteryRow, Pick<MasteryRow, "scope_type" | "scope_id"> & Partial<MasteryRow>>;
      daily_sessions: Table<DailySessionsRow, Pick<DailySessionsRow, "date"> & Partial<DailySessionsRow>>;
      settings: Table<SettingsRow, Partial<SettingsRow>>;
      badges: Table<BadgesRow, Pick<BadgesRow, "id" | "category" | "metric" | "label_hu" | "description_hu" | "threshold"> & Partial<BadgesRow>>;
      suppressed_fact_keys: Table<SuppressedFactKeysRow, Pick<SuppressedFactKeysRow, "fact_key"> & Partial<SuppressedFactKeysRow>>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
