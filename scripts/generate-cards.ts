/**
 * Deterministic card generator (Phase 2, section 5). Thin CLI wrapper over
 * src/lib/pipeline/generate.ts's generateCards() — the same function the
 * JIT pipeline (/api/pipeline/jit) calls after every extraction, so a
 * manual run and an automated run share one implementation.
 *
 * Usage: npx tsx scripts/generate-cards.ts
 */
import { generateCards } from "../src/lib/pipeline/generate";
import { supabaseAdmin } from "./lib/supabase-admin";

generateCards(supabaseAdmin)
  .then(({ cardsCreated }) => {
    console.log(`Done. ${cardsCreated} cards created.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
