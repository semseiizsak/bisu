"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "Nem fontos" — retires a card everywhere: cards.active=false keeps it out
 * of session building, games and counts; card_states.suspended=true keeps it
 * out of the due queue. Content stays in the DB (reversible by hand), and
 * the write goes through the service role because `cards` is deliberately
 * not client-writable.
 */
export async function flagCardNotImportant(cardId: number): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const admin = createAdminClient();
  const { error: cardError } = await admin.from("cards").update({ active: false }).eq("id", cardId);
  if (cardError) throw cardError;
  const { error: stateError } = await admin.from("card_states").update({ suspended: true }).eq("card_id", cardId);
  if (stateError) throw stateError;
}
