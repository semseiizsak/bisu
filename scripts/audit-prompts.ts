/**
 * Audits already-polished card prompts against the structural validation
 * in src/lib/adaptive/polish-prompt.ts (added after real-device testing
 * found direction-inverted reverse questions like "Hány folyója van?" with
 * answer "Éden" — the polish model asked for the value when the answer is
 * the entity, and the original shape-only checks let it through).
 *
 * Failing cards are reset to their raw template (`prompt = prompt_raw`,
 * `prompt_polished_at = null`) so the next polish-prompts.ts run re-does
 * them under the fixed prompt + validation.
 *
 * Usage:
 *   npx tsx scripts/audit-prompts.ts            # report + reset
 *   npx tsx scripts/audit-prompts.ts --dry-run  # report only
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { validatePolishedQuestion, type PolishItem } from "../src/lib/adaptive/polish-prompt";
import { supabaseAdmin } from "./lib/supabase-admin";

config({ path: resolve(process.cwd(), ".env.local") });

interface CardRow {
  id: number;
  type: string;
  prompt: string;
  prompt_raw: string | null;
  answer: string;
  answer_alt: string[];
  tags: string[];
  facts: { fact_key: string; fact_value: string; unit: string | null } | null;
  entities: { name_hu: string; type: string } | null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const { data: rows, error } = await supabaseAdmin
    .from("cards")
    .select(
      "id, type, prompt, prompt_raw, answer, answer_alt, tags, facts(fact_key, fact_value, unit), entities(name_hu, type)",
    )
    .in("type", ["recall", "reverse", "numeric", "mcq"])
    .not("fact_id", "is", null)
    .not("prompt_polished_at", "is", null)
    .eq("active", true)
    .order("id");
  if (error) throw error;

  const cards = (rows ?? []) as unknown as CardRow[];
  console.log(`Auditing ${cards.length} polished cards…`);

  const failures: { id: number; type: string; prompt: string; answer: string }[] = [];
  for (const c of cards) {
    if (!c.facts) continue;
    const item: PolishItem = {
      cardId: c.id,
      cardType: c.type as PolishItem["cardType"],
      entityName: c.entities?.name_hu ?? null,
      entityType: c.entities?.type ?? null,
      factKey: c.facts.fact_key,
      factValue: c.facts.fact_value,
      unit: c.facts.unit,
      isContrast: (c.tags ?? []).includes("contrast"),
      promptRaw: c.prompt_raw,
      answer: c.answer,
      answerAlt: c.answer_alt ?? [],
    };
    if (!validatePolishedQuestion(item, c.prompt)) {
      failures.push({ id: c.id, type: c.type, prompt: c.prompt, answer: c.answer });
    }
  }

  console.log(`\n${failures.length} card(s) fail structural validation:`);
  for (const f of failures) {
    console.log(`  #${f.id} [${f.type}] "${f.prompt}" → answer: "${f.answer}"`);
  }

  if (dryRun || failures.length === 0) {
    if (dryRun) console.log("\n[dry-run] no changes written.");
    return;
  }

  console.log("\nResetting failed cards to their raw template…");
  for (const f of failures) {
    const card = cards.find((c) => c.id === f.id)!;
    const { error: updateError } = await supabaseAdmin
      .from("cards")
      .update({ prompt: card.prompt_raw ?? card.prompt, prompt_polished_at: null })
      .eq("id", f.id);
    if (updateError) throw updateError;
  }
  console.log(`Reset ${failures.length} card(s). Run polish-prompts.ts to re-polish them.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
