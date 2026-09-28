"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createMemoryVerse(input: {
  book_id: number;
  chapter: number;
  verse_from: number;
  verse_to: number;
  reference: string;
  text: string;
}): Promise<number> {
  const supabase = await createClient();
  const { data: card, error } = await supabase
    .from("cards")
    .insert({
      type: "verse",
      prompt: input.reference,
      answer: input.text,
      answer_alt: [],
      book_id: input.book_id,
      chapter: input.chapter,
      verse_ref: input.reference,
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

  const { error: verseError } = await supabase.from("memory_verses").insert({
    card_id: card.id,
    book_id: input.book_id,
    chapter: input.chapter,
    verse_from: input.verse_from,
    verse_to: input.verse_to,
    reference: input.reference,
    text: input.text,
    stage: 1,
  });
  if (verseError) throw verseError;

  revalidatePath("/olvasas");
  revalidatePath("/memoriter");
  revalidatePath("/ma");
  return card.id;
}

/** Clean drill pass moves the verse to a harder presentation stage; picking
 * "Again" on the post-drill rating regresses it — called from VerseTrainer
 * (delta +1) and ReviewSession's rate() (delta -1). Best-effort: a failed
 * call just leaves the verse at its current stage until the next attempt. */
export async function advanceVerseStage(cardId: number, delta: 1 | -1): Promise<void> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("memory_verses").select("stage").eq("card_id", cardId).maybeSingle();
  if (!row) return;
  const stage = Math.min(3, Math.max(1, row.stage + delta));
  if (stage === row.stage) return;
  await supabase.from("memory_verses").update({ stage }).eq("card_id", cardId);
}

/** Retires a memoriter the same way "Nem fontos" retires a quiz card —
 * content stays in the DB, reversible by hand, just stops surfacing. */
export async function removeMemoryVerse(cardId: number): Promise<void> {
  const supabase = await createClient();
  await supabase.from("cards").update({ active: false }).eq("id", cardId);
  await supabase.from("card_states").update({ suspended: true }).eq("card_id", cardId);
  revalidatePath("/memoriter");
}
