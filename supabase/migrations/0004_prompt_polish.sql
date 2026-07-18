-- Section 5.2's AI phrasing-polish pass, applied after the fact: the
-- deterministic templates in generate-cards.ts/detect-contrasts.ts are
-- grammatically naive (blind underscore-to-space substitution on fact_key).
-- prompt_raw preserves that raw template text; prompt_polished_at tracks
-- whether scripts/polish-prompts.ts has rewritten `prompt` into natural
-- Hungarian yet, so the batch script is resumable/idempotent.

alter table cards add column prompt_raw text;
alter table cards add column prompt_polished_at timestamptz;

-- Backfill: every existing card's current (naive) prompt becomes its raw
-- record and is implicitly unpolished, so the next polish-prompts.ts run
-- picks up all pre-existing cards automatically.
update cards set prompt_raw = prompt where prompt_raw is null;
