# Biblia Mastery

Personal-use PWA for memorizing the full factual content of the Bible
(Károli 1908) over one year, using FSRS spaced repetition and adaptive game
modes. Single-user app.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Serwist (PWA) ·
Dexie.js (offline mirror) · Supabase (Postgres + Auth + RLS) · ts-fsrs ·
Zustand · Framer Motion.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase + OpenAI keys
```

Apply the schema once to your Supabase project (SQL Editor, or via the
Supabase MCP tool):

```
supabase/migrations/0001_init.sql
```

Then seed content:

```bash
npx tsx scripts/import-bible.ts      # Károli 1908 text -> books + verses
npx tsx scripts/load-seed.ts         # hand-extracted seed facts (data/seed/*.json)
npx tsx scripts/generate-cards.ts    # deterministic card generation from facts
```

Run the app:

```bash
npm run dev
```

## Content pipeline

- `scripts/import-bible.ts` — imports the full public-domain Károli 1908
  text (1189 chapters, 31126 verses) from api.getbible.net.
- `scripts/extract-facts.ts` — full-corpus entity/fact extraction via the
  OpenAI API (one call per chapter, resumable, writes to
  `data/extracted/` before touching the DB). Requires `OPENAI_API_KEY`.
  This is a deliberate, costly batch job — run by hand, not automatically.
- `data/seed/*.json` — a hand-extracted seed slice (Genesis 1–11, Ruth)
  loaded via `scripts/load-seed.ts`, so the app is usable end-to-end without
  running the full extraction.
- `scripts/dedupe-entities.ts` — flags likely-duplicate entities for manual
  review (never auto-merges).
- `scripts/generate-cards.ts` — deterministic card generation from
  facts/entities/timeline/genealogy/geo data.
- `/admin/facts` — keyboard-driven review UI for unverified /
  low-confidence facts (j/k navigate, Enter approve, e edit).

## Gates (per phase)

Phases 0–3 (scaffold, content pipeline, card generator, SRS engine) make
the app usable end to end; later phases build on top while the reading
year is already running.
