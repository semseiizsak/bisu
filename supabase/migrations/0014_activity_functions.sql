-- Server-side aggregates for the two computations that used to pull every
-- review row into the app on every page load (and silently truncated at
-- PostgREST's 1000-row cap once the review log grew past it).

-- Distinct activity days (a review or a completed reading), newest first.
create or replace function activity_days()
returns setof date
language sql
stable
as $$
  select d from (
    select distinct (reviewed_at at time zone 'Europe/Budapest')::date as d from reviews
    union
    select distinct (completed_at at time zone 'Europe/Budapest')::date from reading_log where completed_at is not null
  ) days
  order by d desc;
$$;

-- Total XP and XP since a timestamp, in one call.
create or replace function xp_totals(since timestamptz)
returns table (total bigint, recent bigint)
language sql
stable
as $$
  select
    coalesce(sum(amount), 0)::bigint as total,
    coalesce(sum(amount) filter (where created_at >= since), 0)::bigint as recent
  from xp_events;
$$;
