import OpenAI from "openai";
import pLimit from "p-limit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { polishBatch, type PolishItem } from "@/lib/adaptive/polish-prompt";

type DB = SupabaseClient<Database>;

const CONCURRENCY = 5;
const MAX_ROUNDS = 5;

interface CardRow {
  id: number;
  type: string;
  prompt_raw: string | null;
  answer: string;
  answer_alt: string[];
  tags: string[];
  fact_id: number;
  facts: { fact_key: string; fact_value: string; unit: string | null } | null;
  entities: { name_hu: string; type: string } | null;
}

/** Runs one round of concurrent batches over `items`, returns which ids still need polish. */
async function runRound(admin: DB, openai: OpenAI, items: PolishItem[], batchSize: number) {
  const limiter = pLimit(CONCURRENCY);
  const batches: PolishItem[][] = [];
  for (let i = 0; i < items.length; i += batchSize) batches.push(items.slice(i, i + batchSize));

  let polished = 0;
  const remaining: PolishItem[] = [];

  await Promise.all(
    batches.map((batch) =>
      limiter(async () => {
        const resultMap = await polishBatch(openai, batch);
        const now = new Date().toISOString();
        for (const item of batch) {
          const polishedPrompt = resultMap.get(item.cardId);
          if (!polishedPrompt) {
            remaining.push(item);
            continue;
          }
          polished++;
          const { error } = await admin.from("cards").update({ prompt: polishedPrompt, prompt_polished_at: now }).eq("id", item.cardId);
          if (error) throw error;
        }
      }),
    ),
  );

  return { polished, remaining };
}

/**
 * Polishes every unpolished recall/reverse/numeric/mcq card's phrasing via
 * OpenAI (same logic as scripts/polish-prompts.ts, minus the local
 * data/polished/*.json audit dump — not useful in a serverless run).
 * Resumable via cards.prompt_polished_at, so this is safe to call after
 * every generateCards() pass: it only ever touches cards that don't have
 * one yet.
 */
export async function polishPendingCards(admin: DB, apiKey: string, opts?: { limit?: number }): Promise<{ polished: number; remaining: number }> {
  const openai = new OpenAI({ apiKey });

  let query = admin
    .from("cards")
    .select("id, type, prompt_raw, answer, answer_alt, tags, fact_id, facts(fact_key, fact_value, unit), entities(name_hu, type)")
    .in("type", ["recall", "reverse", "numeric", "mcq"])
    .not("fact_id", "is", null)
    .is("prompt_polished_at", null)
    .eq("active", true)
    .order("id");
  if (opts?.limit) query = query.limit(opts.limit);

  const { data: rows, error } = await query;
  if (error) throw error;

  const cards = (rows ?? []) as unknown as CardRow[];
  if (cards.length === 0) return { polished: 0, remaining: 0 };

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

  let totalPolished = 0;
  let batchSize = 20;
  for (let round = 1; round <= MAX_ROUNDS && items.length > 0; round++) {
    const { polished, remaining } = await runRound(admin, openai, items, batchSize);
    totalPolished += polished;
    if (remaining.length === items.length) {
      items = remaining;
      break;
    }
    items = remaining;
    batchSize = Math.max(5, Math.ceil(batchSize / 2));
  }

  return { polished: totalPolished, remaining: items.length };
}
