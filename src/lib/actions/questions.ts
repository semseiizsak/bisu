"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * The post-reading gate: after a chapter, every generated question is shown
 * once with a keep / skip toggle. Skipping retires the card before it ever
 * enters the queue (reversible: flip it back on the same screen). Keeping
 * stamps reviewed_at so the quiz can tell "seen and approved" from "never
 * looked at".
 */
export async function setQuestionKept(cardId: number, kept: boolean): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error: cardError } = await supabase
    .from("cards")
    .update(kept ? { active: true, reviewed_at: now } : { active: false, reviewed_at: now })
    .eq("id", cardId);
  if (cardError) throw cardError;

  const { error: stateError } = await supabase.from("card_states").update({ suspended: !kept }).eq("card_id", cardId);
  if (stateError) throw stateError;
}

/** "Nem fontos" inside the quiz: retire this one card and move on. */
export async function flagCardNotImportant(cardId: number): Promise<void> {
  const supabase = await createClient();
  const { error: cardError } = await supabase.from("cards").update({ active: false, reviewed_at: new Date().toISOString() }).eq("id", cardId);
  if (cardError) throw cardError;
  const { error: stateError } = await supabase.from("card_states").update({ suspended: true }).eq("card_id", cardId);
  if (stateError) throw stateError;
}

/** Marks the plan day's reading as done (moves the plan forward). */
export async function markDayRead(dayIdx: number, minutes: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("reading_log").upsert({ day_idx: dayIdx, completed_at: new Date().toISOString(), minutes });
  if (error) throw error;
  revalidatePath("/ma");
  revalidatePath("/olvasas");
}
