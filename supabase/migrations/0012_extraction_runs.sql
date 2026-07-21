-- Just-in-time content pipeline resumability. Vercel has no persistent
-- filesystem, so unlike scripts/extract-facts.ts's data/extracted/*.json
-- cache, the JIT pipeline's "have we already tried this chapter" marker
-- lives in the DB. An 'error' row blocks automatic retry by design (a
-- human can delete the row, or run the CLI script directly, to force one)
-- — with only ~2 chapters/day, that's a deliberate simplicity trade-off
-- over building retry-with-backoff for a single-owner app.
create table extraction_runs (
  book_slug  text not null,
  chapter    int not null,
  status     text not null check (status in ('done', 'error')),
  fact_count int not null default 0,
  error      text,
  model      text not null,
  created_at timestamptz not null default now(),
  primary key (book_slug, chapter)
);

alter table extraction_runs enable row level security;
create policy extraction_runs_select_authenticated on extraction_runs for select using (auth.uid() is not null);
-- No client insert/update policy — written only via the service role.

-- Backfill: every chapter that already has at least one fact was covered
-- by the original full-corpus extraction batch, so the JIT pipeline must
-- not try to re-extract it.
insert into extraction_runs (book_slug, chapter, status, fact_count, model)
select b.slug, f.chapter, 'done', count(*), 'backfill'
from facts f
join books b on b.id = f.book_id
where f.chapter is not null
group by b.slug, f.chapter
on conflict (book_slug, chapter) do nothing;
