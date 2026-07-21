-- AI weekly coach: converts the review stats already on /haladas into a
-- short plain-Hungarian coaching note. One row per ISO week (Monday,
-- Europe/Budapest); the primary key collapses concurrent-generation races.
create table coach_reports (
  week_start   date primary key,
  body         text not null,
  stats        jsonb not null,
  generated_at timestamptz not null default now()
);

alter table coach_reports enable row level security;
create policy coach_reports_select_authenticated on coach_reports for select using (auth.uid() is not null);
-- No client insert/update policy — written only via the service role.
