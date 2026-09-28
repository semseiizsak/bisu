/**
 * Generates the game-only card types (locate / order / chain / map) from
 * verses, timeline_events, genealogy_edges and geo_places. Idempotent.
 * Quiz questions come from scripts/generate-questions.ts instead.
 *
 * Usage: npx tsx scripts/generate-cards.ts
 */
import { generateGameCards } from "../src/lib/pipeline/generate";
import { supabaseAdmin } from "./lib/supabase-admin";

generateGameCards(supabaseAdmin)
  .then(({ cardsCreated }) => {
    console.log(`Done. ${cardsCreated} game card(s) created.`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
