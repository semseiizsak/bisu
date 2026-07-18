/**
 * Section 10.2 — nightly difficulty tuning. Adjusts settings.new_cards_per_day
 * based on the 7-day rolling review accuracy: >92% raises the pace (max 45),
 * <78% eases off (min 15). The "more MCQ / harder variants" side of this
 * rule is already covered by the adaptive variant chain (section 10.1),
 * which naturally trends questions toward mcq/numeric as accuracy stays high.
 *
 * Usage: npx tsx scripts/tune-difficulty.ts
 */
import { supabaseAdmin } from "./lib/supabase-admin";

async function main() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: reviews } = await supabaseAdmin.from("reviews").select("rating").gte("reviewed_at", sevenDaysAgo);

  if (!reviews || reviews.length < 20) {
    console.log(`Only ${reviews?.length ?? 0} reviews in the last 7 days — not enough signal, skipping.`);
    return;
  }

  const correct = reviews.filter((r) => r.rating >= 3).length;
  const accuracy = correct / reviews.length;

  const { data: settings } = await supabaseAdmin.from("settings").select("new_cards_per_day").eq("id", 1).maybeSingle();
  const current = settings?.new_cards_per_day ?? 30;

  let next = current;
  if (accuracy > 0.92) next = Math.min(45, current + 5);
  else if (accuracy < 0.78) next = Math.max(15, current - 5);

  console.log(`7-day accuracy: ${(accuracy * 100).toFixed(1)}% — new_cards_per_day: ${current} -> ${next}`);

  if (next !== current) {
    const { error } = await supabaseAdmin.from("settings").update({ new_cards_per_day: next }).eq("id", 1);
    if (error) throw error;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
