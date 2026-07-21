-- Fact-level "not important" flagging. Previously flagCardNotImportant
-- retired a single card row; every sibling card generated from the same
-- fact (recall/reverse/numeric/mcq can all share one fact_id) stayed live,
-- and the adaptive variant engine could regenerate the fact in a new shape
-- from any still-active sibling. Flagging now suppresses the fact itself.

alter table facts add column suppressed boolean not null default false;
create index facts_suppressed_idx on facts (suppressed) where suppressed = true;

-- "Minden hasonló elrejtése" — suppresses every fact sharing a fact_key
-- (e.g. every patriarch's "kora_első_fia_születésekor"), including ones
-- extracted in the future.
create table suppressed_fact_keys (
  fact_key   text primary key,
  created_at timestamptz default now()
);

alter table suppressed_fact_keys enable row level security;
create policy suppressed_fact_keys_select_authenticated on suppressed_fact_keys
  for select using (auth.uid() is not null);
-- No client insert/update policy — written only via the service role
-- (server action), same as facts/cards.
