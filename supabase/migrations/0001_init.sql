-- Biblia Mastery — initial schema
-- Single-user app: RLS is enabled everywhere with "auth.uid() is not null" policies.
-- Content tables are written by scripts using the service role key (bypasses RLS).

-- =========================================================================
-- 2.1 Content tables
-- =========================================================================

create table books (
  id             serial primary key,
  slug           text unique not null,
  name_hu        text not null,
  short_hu       text not null,
  testament      text not null check (testament in ('OT','NT')),
  order_idx      int not null,
  genre          text not null,
  chapters_count int not null
);

create table verses (
  id      bigserial primary key,
  book_id int references books(id),
  chapter int not null,
  verse   int not null,
  text    text not null,
  unique (book_id, chapter, verse)
);
create index on verses (book_id, chapter);

create table entities (
  id          bigserial primary key,
  type        text not null,
  name_hu     text not null,
  aliases     text[] default '{}',
  summary     text,
  first_ref   text,
  ref_count   int default 0,
  importance  int default 3
);
create index on entities (type);
create index on entities using gin (aliases);

create table facts (
  id          bigserial primary key,
  entity_id   bigint references entities(id),
  fact_key    text not null,
  fact_value  text not null,
  numeric_val numeric,
  unit        text,
  verse_ref   text not null,
  book_id     int references books(id),
  chapter     int,
  difficulty  int default 3,
  confidence  numeric default 1.0,
  verified    boolean default false,
  tags        text[] default '{}'
);
create index on facts (entity_id);
create index on facts (book_id, chapter);
create index on facts (verified);

create table timeline_events (
  id          bigserial primary key,
  label_hu    text not null,
  era         text not null,
  order_idx   int not null,
  approx_year text,
  verse_ref   text,
  importance  int default 3
);

create table genealogy_edges (
  id            bigserial primary key,
  parent_id     bigint references entities(id),
  child_id      bigint references entities(id),
  line          text,
  verse_ref     text,
  order_in_line int
);

create table geo_places (
  id          bigserial primary key,
  entity_id   bigint references entities(id),
  svg_x       numeric not null,
  svg_y       numeric not null,
  place_type  text,
  tolerance   numeric default 30
);

-- =========================================================================
-- 2.2 Cards
-- =========================================================================

create table cards (
  id           bigserial primary key,
  type         text not null,
  prompt       text not null,
  answer       text not null,
  answer_alt   text[] default '{}',
  distractors  text[] default '{}',
  payload      jsonb,
  fact_id      bigint references facts(id),
  entity_id    bigint references entities(id),
  book_id      int references books(id),
  chapter      int,
  verse_ref    text,
  difficulty   int default 3,
  tags         text[] default '{}',
  variant_of   bigint references cards(id),
  source       text default 'generated',
  active       boolean default true,
  created_at   timestamptz default now()
);
create index on cards (book_id, chapter);
create index on cards (entity_id);
create index on cards (type);
create index on cards (active) where active = true;

-- =========================================================================
-- 2.3 Learning state
-- =========================================================================

create table card_states (
  card_id     bigint primary key references cards(id),
  stability   numeric,
  difficulty  numeric,
  due_at      timestamptz,
  last_review timestamptz,
  reps        int default 0,
  lapses      int default 0,
  state       int default 0,
  suspended   boolean default false
);
create index on card_states (due_at) where suspended = false;

create table reviews (
  id           bigserial primary key,
  card_id      bigint references cards(id),
  rating       int not null,
  state_before int,
  elapsed_days numeric,
  duration_ms  int,
  mode         text,
  reviewed_at  timestamptz default now()
);
create index on reviews (reviewed_at);

-- =========================================================================
-- 2.4 Plan and progress
-- =========================================================================

create table reading_plan (
  day_idx     int primary key,
  phase       int not null,
  segments    jsonb not null,
  est_minutes int not null,
  focus_note  text
);

create table reading_log (
  day_idx      int primary key references reading_plan(day_idx),
  completed_at timestamptz,
  minutes      int,
  notes        text
);

create table mastery (
  scope_type   text not null,
  scope_id     text not null,
  coverage     numeric default 0,
  retention    numeric default 0,
  score        numeric default 0,
  card_count   int default 0,
  updated_at   timestamptz default now(),
  primary key (scope_type, scope_id)
);

create table daily_sessions (
  date            date primary key,
  budget_minutes  int default 90,
  spent_minutes   numeric default 0,
  reading_minutes numeric default 0,
  srs_minutes     numeric default 0,
  game_minutes    numeric default 0,
  cards_done      int default 0,
  cards_correct   int default 0,
  streak_kept     boolean default false,
  plan            jsonb,
  completed       boolean default false
);

create table settings (
  id                   int primary key default 1,
  daily_budget_minutes int default 90,
  new_cards_per_day    int default 30,
  reading_speed_wpm    int default 200,
  timezone             text default 'Europe/Budapest'
);
insert into settings (id) values (1);

-- =========================================================================
-- Row Level Security — single-user app, every table gated on auth.uid()
-- =========================================================================

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'books','verses','entities','facts','timeline_events','genealogy_edges',
      'geo_places','cards','card_states','reviews','reading_plan','reading_log',
      'mastery','daily_sessions','settings'
    ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for select using (auth.uid() is not null);',
      t || '_select_authenticated', t
    );
  end loop;
end $$;

-- Content tables (books, verses, entities, facts, timeline_events,
-- genealogy_edges, geo_places, cards) are read-only to the client;
-- they are written only via the service role key by pipeline scripts.

-- User-state tables also need authenticated write access from the client.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'card_states','reviews','reading_log','mastery','daily_sessions','settings'
    ])
  loop
    execute format(
      'create policy %I on %I for insert with check (auth.uid() is not null);',
      t || '_insert_authenticated', t
    );
    execute format(
      'create policy %I on %I for update using (auth.uid() is not null) with check (auth.uid() is not null);',
      t || '_update_authenticated', t
    );
  end loop;
end $$;
