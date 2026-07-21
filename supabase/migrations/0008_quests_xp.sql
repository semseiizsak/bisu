-- XP is an idempotent ledger, not per-review events: reviews sync
-- offline-first with no single write choke point (same reason badges are
-- checked on page load, not on write), so XP is *derived* server-side from
-- already-synced data and upserted under a deterministic `ref` key. A
-- recompute just overwrites `amount` in place — safe to call on every load.
create table xp_events (
  id         bigserial primary key,
  amount     int not null,
  kind       text not null,        -- 'reading' | 'cards' | 'game' | 'quest' | 'blitz'
  ref        text unique not null, -- idempotency key, e.g. 'cards:2026-07-20'
  created_at timestamptz default now()
);

create table daily_quests (
  day_idx      int not null,
  quest_key    text not null,
  label_hu     text not null,
  target       int not null,
  progress     int not null default 0,
  xp           int not null default 20,
  completed_at timestamptz,
  seen_at      timestamptz,
  primary key (day_idx, quest_key)
);

alter table xp_events enable row level security;
create policy xp_events_select_authenticated on xp_events for select using (auth.uid() is not null);
create policy xp_events_insert_authenticated on xp_events for insert with check (auth.uid() is not null);
create policy xp_events_update_authenticated on xp_events for update using (auth.uid() is not null) with check (auth.uid() is not null);

alter table daily_quests enable row level security;
create policy daily_quests_select_authenticated on daily_quests for select using (auth.uid() is not null);
create policy daily_quests_insert_authenticated on daily_quests for insert with check (auth.uid() is not null);
create policy daily_quests_update_authenticated on daily_quests for update using (auth.uid() is not null) with check (auth.uid() is not null);
