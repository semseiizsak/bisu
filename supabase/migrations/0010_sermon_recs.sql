-- Sermon recommendations: YouTube teaching clips from trusted preachers,
-- matched to the topics of the passage being read. Keyed by (book_id,
-- chapter) rather than day_idx — a reading day can span several chapters,
-- and keying per-chapter means recs work when browsing any chapter, not
-- only while inside the daily-flow session.
create table preachers (
  id             bigserial primary key,
  name           text not null,
  channel_id     text,
  query_modifier text not null default '',
  enabled        boolean not null default true,
  created_at     timestamptz default now()
);

-- User-expandable list (the owner's own trusted-preacher curation), so
-- unlike facts/cards this allows direct authenticated writes.
alter table preachers enable row level security;
create policy preachers_select_authenticated on preachers for select using (auth.uid() is not null);
create policy preachers_insert_authenticated on preachers for insert with check (auth.uid() is not null);
create policy preachers_update_authenticated on preachers for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy preachers_delete_authenticated on preachers for delete using (auth.uid() is not null);

insert into preachers (name, channel_id, query_modifier) values
  ('Derek Prince', null, 'Derek Prince magyarul tanítás'),
  ('Németh Sándor', null, 'Németh Sándor prédikáció'),
  ('Ruff Tibor', null, 'Ruff Tibor tanítás'),
  ('Hit Gyülekezete', null, 'Hit Gyülekezete prédikáció');

-- AI-derived topic cache per chapter — also doubles as the "already tried
-- this chapter recently" marker so a zero-result search doesn't get
-- re-queried on every page load within the TTL window.
create table day_topics (
  book_id      bigint not null references books(id),
  chapter      int not null,
  keywords     text[] not null default '{}',
  generated_at timestamptz not null default now(),
  primary key (book_id, chapter)
);

alter table day_topics enable row level security;
create policy day_topics_select_authenticated on day_topics for select using (auth.uid() is not null);
-- No client insert/update policy — written only via the service role.

create table sermon_recs (
  book_id       bigint not null references books(id),
  chapter       int not null,
  video_id      text not null,
  preacher_id   bigint not null references preachers(id),
  title         text not null,
  channel_title text not null,
  thumbnail_url text,
  published_at  timestamptz,
  fetched_at    timestamptz not null default now(),
  primary key (book_id, chapter, video_id)
);

alter table sermon_recs enable row level security;
create policy sermon_recs_select_authenticated on sermon_recs for select using (auth.uid() is not null);
-- No client insert/update policy — written only via the service role.
