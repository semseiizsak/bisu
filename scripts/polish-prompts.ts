/**
 * AI phrasing-polish batch pass (section 5.2 of the original design
 * intent — see src/lib/adaptive/polish-prompt.ts for why this exists).
 * Rewrites the naive-template `prompt` text into grammatically correct
 * Hungarian via OpenAI, never touching `answer`/`distractors`/`payload`.
 *
 * Resumable/idempotent via cards.prompt_polished_at — safe to rerun after
 * any content-pipeline step that adds new recall/reverse/numeric/mcq
 * cards (generate-cards.ts, detect-contrasts.ts, or the adaptive runtime
 * variant path).
 *
 * Large batches occasionally come back with a few IDs missing from the
 * model's JSON response (not a validation rejection — it just doesn't
 * enumerate every key), so this runs multiple rounds against whatever's
 * still unpolished, shrinking the batch size each round to raise the odds
 * of a clean pass.
 *
 * The JIT pipeline (src/lib/pipeline/polish.ts, called from
 * /api/pipeline/jit) runs a no-frills version of this same loop
 * automatically after every extraction; this script is the interactive
 * variant for large manual batches (dry-run, round-by-round progress).
 *
 * Usage:
 *   npx tsx scripts/polish-prompts.ts
 *   npx tsx scripts/polish-prompts.ts --limit 50   # process a small batch first
 *   npx tsx scripts/polish-prompts.ts --dry-run     # print without writing
 */
import OpenAI from "openai";
import pLimit from "p-limit";
import { config } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { polishBatch, type PolishItem } from "../src/lib/adaptive/polish-prompt";
import { supabaseAdmin } from "./lib/supabase-admin";

config({ path: resolve(process.cwd(), ".env.local") });

const CONCURRENCY = 5;
const MAX_ROUNDS = 5;
const OUT_DIR = resolve(process.cwd(), "data/polished");

interface CardRow {
  id: number;
  type: string;
  prompt_raw: string | null;
  answer: string;
  answer_alt: string[];
  tags: string[];
  fact_id: number;
  facts: {
    fact_key: string;
    fact_value: string;
    unit: string | null;
  } | null;
  entities: {
    name_hu: string;
    type: string;
  } | null;
}

/** Runs one round of batches over `items`, returns the ids that still need polish. */
async function runRound(
  openai: OpenAI,
  items: PolishItem[],
  batchSize: number,
  round: number,
  dryRun: boolean,
): Promise<{ polished: number; remaining: PolishItem[] }> {
  const limiter = pLimit(CONCURRENCY);
  const batches: PolishItem[][] = [];
  for (let i = 0; i < items.length; i += batchSize) batches.push(items.slice(i, i + batchSize));

  let polished = 0;
  const remaining: PolishItem[] = [];

  await Promise.all(
    batches.map((batch, batchIdx) =>
      limiter(async () => {
        const resultMap = await polishBatch(openai, batch);
        await writeFile(
          resolve(OUT_DIR, `round${round}-batch-${batchIdx}.json`),
          JSON.stringify({ requested: batch.map((b) => b.cardId), resolved: Object.fromEntries(resultMap) }, null, 2),
          "utf-8",
        );

        const now = new Date().toISOString();
        for (const item of batch) {
          const polishedPrompt = resultMap.get(item.cardId);
          if (!polishedPrompt) {
            remaining.push(item);
            continue;
          }
          polished++;
          if (dryRun) {
            console.log(`[dry-run] #${item.cardId} (${item.cardType}): ${polishedPrompt}`);
            continue;
          }
          const { error: updateError } = await supabaseAdmin
            .from("cards")
            .update({ prompt: polishedPrompt, prompt_polished_at: now })
            .eq("id", item.cardId);
          if (updateError) throw updateError;
        }
        process.stdout.write(`\r  round ${round}: batch ${batchIdx + 1}/${batches.length}`);
      }),
    ),
  );

  return { polished, remaining };
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing in .env.local");
  const openai = new OpenAI({ apiKey });

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : undefined;

  console.log("Loading cards that need polish…");
  let query = supabaseAdmin
    .from("cards")
    .select("id, type, prompt_raw, answer, answer_alt, tags, fact_id, facts(fact_key, fact_value, unit), entities(name_hu, type)")
    .in("type", ["recall", "reverse", "numeric", "mcq"])
    .not("fact_id", "is", null)
    .is("prompt_polished_at", null)
    .eq("active", true)
    .order("id");
  if (limit) query = query.limit(limit);

  const { data: rows, error } = await query;
  if (error) throw error;

  const cards = (rows ?? []) as unknown as CardRow[];
  console.log(`Found ${cards.length} unpolished cards.`);
  if (cards.length === 0) return;

  let items: PolishItem[] = cards
    .filter((c) => c.facts)
    .map((c) => ({
      cardId: c.id,
      cardType: c.type as PolishItem["cardType"],
      entityName: c.entities?.name_hu ?? null,
      entityType: c.entities?.type ?? null,
      factKey: c.facts!.fact_key,
      factValue: c.facts!.fact_value,
      unit: c.facts!.unit,
      isContrast: (c.tags ?? []).includes("contrast"),
      promptRaw: c.prompt_raw,
      answer: c.answer,
      answerAlt: c.answer_alt ?? [],
    }));

  await mkdir(OUT_DIR, { recursive: true });

  let totalPolished = 0;
  let batchSize = 20;
  for (let round = 1; round <= MAX_ROUNDS && items.length > 0; round++) {
    const { polished, remaining } = await runRound(openai, items, batchSize, round, dryRun);
    totalPolished += polished;
    console.log(`\nRound ${round}: polished ${polished}, still unresolved ${remaining.length}.`);
    if (remaining.length === items.length) {
      // No progress this round — further rounds won't help (e.g. persistent validation failures).
      items = remaining;
      break;
    }
    items = remaining;
    batchSize = Math.max(5, Math.ceil(batchSize / 2));
  }

  console.log(`\nDone. Polished: ${totalPolished}, still unpolished (will retry next run): ${items.length}.`);
  if (items.length > 0) {
    console.log("Unresolved card ids:", items.map((i) => i.cardId).join(", "));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
