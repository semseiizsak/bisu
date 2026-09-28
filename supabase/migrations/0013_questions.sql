-- Question-first content model.
--
-- The original pipeline extracted "facts" (every number, age and headcount
-- in a chapter) and fanned each one out into recall / reverse / numeric /
-- mcq / cloze cards. The result was a deck dominated by genealogy trivia
-- with nonsensical distractors. This migration switches to one finished,
-- validated question per card (cards.type = 'question'), generated per
-- chapter together with a short study note, and retires the old cards.

-- ---------------------------------------------------------------------------
-- 1. Per-chapter study notes (summary, context, key verse, cross-refs)
-- ---------------------------------------------------------------------------
create table chapter_notes (
  book_id       int not null references books(id),
  chapter       int not null,
  summary       text not null,
  context       text not null,
  key_verse_ref text,
  key_verse_why text,
  cross_refs    jsonb not null default '[]',   -- [{ ref, why }]
  themes        text[] not null default '{}',
  model         text not null,
  generated_at  timestamptz not null default now(),
  primary key (book_id, chapter)
);

alter table chapter_notes enable row level security;
create policy chapter_notes_select_authenticated on chapter_notes
  for select using (auth.uid() is not null);
-- Written only via the service role (pipeline).

-- ---------------------------------------------------------------------------
-- 2. Cards: question kind + the post-reading keep/skip gate
-- ---------------------------------------------------------------------------
alter table cards add column if not exists kind text;
alter table cards add column if not exists reviewed_at timestamptz;
create index if not exists cards_kind_idx on cards (kind) where kind is not null;
create index if not exists cards_type_book_chapter_idx on cards (type, book_id, chapter) where active = true;

-- ---------------------------------------------------------------------------
-- 3. Pipeline run tracking: one row per (chapter, pipeline kind)
-- ---------------------------------------------------------------------------
alter table extraction_runs add column if not exists kind text not null default 'facts';
alter table extraction_runs drop constraint if exists extraction_runs_pkey;
alter table extraction_runs add primary key (book_slug, chapter, kind);

-- ---------------------------------------------------------------------------
-- 4. Retire the fan-out cards. Rows and review history are kept; the cards
--    simply leave every queue. Manual cards, memory verses and the game-only
--    card types (locate / order / chain / map) stay active.
-- ---------------------------------------------------------------------------
update cards
set active = false
where active = true
  and type in ('recall', 'reverse', 'numeric', 'mcq', 'cloze')
  and source in ('generated', 'runtime');

update card_states cs
set suspended = true
from cards c
where c.id = cs.card_id
  and c.active = false
  and cs.suspended = false;

-- ---------------------------------------------------------------------------
-- 5. A sustainable daily budget. 90 minutes a day was the single biggest
--    reason to abandon the program; 25 is the new default and the old
--    default value is migrated in place.
-- ---------------------------------------------------------------------------
alter table settings alter column daily_budget_minutes set default 25;
alter table settings alter column new_cards_per_day set default 20;
update settings set daily_budget_minutes = 25 where daily_budget_minutes = 90;
update settings set new_cards_per_day = 20 where new_cards_per_day >= 30;
