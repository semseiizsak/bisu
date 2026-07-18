"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAndAwardBadges } from "@/lib/badges/check";

export async function createManualCard(input: {
  prompt: string;
  answer: string;
  book_id: number;
  chapter: number;
  verse_ref: string;
}) {
  const supabase = await createClient();
  const { data: card, error } = await supabase
    .from("cards")
    .insert({
      type: "recall",
      prompt: input.prompt,
      answer: input.answer,
      book_id: input.book_id,
      chapter: input.chapter,
      verse_ref: input.verse_ref,
      difficulty: 3,
      source: "manual",
      active: true,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: stateError } = await supabase.from("card_states").insert({
    card_id: card.id,
    state: 0,
    due_at: new Date().toISOString(),
    reps: 0,
    lapses: 0,
    suspended: false,
  });
  if (stateError) throw stateError;

  revalidatePath("/olvasas");
  return card.id;
}

export async function markDayRead(day_idx: number, minutes: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("reading_log").upsert({
    day_idx,
    completed_at: new Date().toISOString(),
    minutes,
  });
  if (error) throw error;
  revalidatePath("/olvasas");
  await checkAndAwardBadges(supabase);
}
