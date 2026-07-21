-- Verse memorization (first-letter method). Each memorized verse is a normal
-- card (cards.type='verse') with a normal card_states row, so FSRS
-- scheduling, session blocks, streak, and the day ring all work unchanged —
-- this table only carries the extra data the trainer needs (the raw verse
-- text and which of the 3 presentation stages it's currently drilled at).
create table memory_verses (
  id          bigserial primary key,
  card_id     bigint not null unique references cards(id),
  book_id     bigint not null references books(id),
  chapter     int not null,
  verse_from  int not null,
  verse_to    int not null,
  reference   text not null,
  text        text not null,
  stage       int not null default 1 check (stage between 1 and 3),
  created_at  timestamptz default now()
);

alter table memory_verses enable row level security;
create policy memory_verses_select_authenticated on memory_verses
  for select using (auth.uid() is not null);
-- No client insert/update policy — written only via the service role
-- (server action, same pattern as manual card creation), since the row
-- is coupled 1:1 with a cards row that's itself service-role-write-only.
