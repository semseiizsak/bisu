# Biblia Mastery

Personal-use PWA for reading through the Bible (Károli 1908) in a year and
actually remembering it: every chapter comes with a short study note and a
handful of questions worth asking, drilled with FSRS spaced repetition.
Single-user app.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Serwist (PWA) ·
Dexie.js (offline mirror) · Supabase (Postgres + Auth + RLS) · ts-fsrs ·
Zustand · Framer Motion · OpenAI.

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase + OpenAI keys
```

Apply the migrations in order to your Supabase project (SQL Editor, or via
the Supabase MCP tool): `supabase/migrations/0001_init.sql` … `0013_questions.sql`.

Seed content:

```bash
npx tsx scripts/import-bible.ts            # Károli 1908 text -> books + verses
npx tsx scripts/generate-reading-plan.ts   # the 365-day plan
npx tsx scripts/generate-questions.ts --book genesis --chapter 1 --print   # try one chapter
npx tsx scripts/generate-questions.ts --upcoming                             # the next week of the plan
npx tsx scripts/load-seed.ts               # optional: hand-made timeline / genealogy / map data for the games
npx tsx scripts/generate-cards.ts          # game-only cards (locate / order / chain / map)
```

Run the app:

```bash
npm run dev
npm test        # pure-function tests (question validation, plan day index)
```

## How content works

One model call per chapter (`src/lib/pipeline/questions.ts`) returns:

- a **study note**: summary, where the chapter sits in the story, a key
  verse, 2–3 cross-references, themes (`chapter_notes` table);
- **4–6 questions** a good Bible teacher would ask after that chapter:
  what happened and why, who did what, what was said, what it means.
  At most one number question per chapter, and only for memorable numbers.
  Each question ships with a short answer, accepted alternatives, three
  distractors of the same kind, a one-sentence "why it matters", and a
  verse reference.

A validator (`validateChapterQuestions`, covered by `npm test`) rejects
answer leaks, out-of-chapter references, mixed-kind distractors, duplicates
and anything not self-contained. One question = one card (`cards.type =
'question'`). There is no fact table feeding a fan-out any more; the old
recall/reverse/numeric/mcq/cloze cards were retired by migration 0013.

Generation runs three ways, all through the same code:

- nightly Vercel cron (`/api/pipeline/jit`) covers the next four plan days;
- opening a chapter (or the Today page) whose questions don't exist yet
  triggers generation on the spot;
- `scripts/generate-questions.ts` for batch runs, with a JSON cache in
  `data/questions/` and `--print` to eyeball quality.

Model: `OPENAI_QUESTION_MODEL` (default `gpt-4o`), structured JSON output.

## The daily loop

1. **Read** today's chapters (`/olvasas/<book>/<chapter>?flow=daily`).
   The study note appears under the text, after you've read it.
2. **Gate**: after each chapter, the note and its questions with a
   keep / skip toggle. Only kept questions ever reach the quiz.
3. **Quiz** (`/ma/session`): due reviews first, then new questions from
   the chapters you just read (never a random slice of the corpus), then a
   short weak-spot block. New questions start as multiple choice and switch
   to typed recall once you've got them right twice.
4. **Game** of the day (locate / timeline / numbers / chain / who-said /
   map / boss), fed from questions you've already studied.

The plan advances by completion, not by the calendar: coming back after a
break resumes where you stopped. Default budget is 25 minutes a day.

## Scripts

- `import-bible.ts` — full public-domain Károli text from api.getbible.net.
- `generate-reading-plan.ts` — 365-day plan, ≤55 min reading per day.
- `generate-questions.ts` — see above. `--book`, `--chapter`, `--upcoming`, `--force`, `--print`.
- `generate-cards.ts` — game-only card types.
- `load-seed.ts` — hand-made entities / timeline / genealogy / geo seed for the games.
- `compute-mastery.ts` — nightly per-book mastery scores.
- `check-coverage.ts` — chapters with fewer than 3 active questions.
- `tune-difficulty.ts` — nudges `new_cards_per_day` from the 7-day accuracy.
- `dedupe-entities.ts` — flags likely-duplicate entities for manual review.
