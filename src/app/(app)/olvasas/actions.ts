"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAndAwardBadges } from "@/lib/badges/check";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return supabase;
}

export async function createManualCard(input: {
  prompt: string;
  answer: string;
  answer_alt?: string[];
  book_id: number;
  chapter: number;
  verse_ref: string;
}) {
  await requireUser();

  // `cards` is service-role-only by design (migration 0005) — the cookie
  // client can read it but not write it, so manual card creation must go
  // through the admin client after the auth check above.
  const admin = createAdminClient();
  const { data: card, error } = await admin
    .from("cards")
    .insert({
      type: "recall",
      prompt: input.prompt,
      answer: input.answer,
      answer_alt: input.answer_alt ?? [],
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

  const { error: stateError } = await admin.from("card_states").insert({
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

export interface CardSuggestion {
  question: string;
  answer: string;
  answer_alt: string[];
}

const SUGGEST_SYSTEM = `Bibliai memorizáló kvízhez készítesz kérdéskártyát egy Károli-fordítású
szövegrészletből. Szabályok:
- Egyetlen természetes, nyelvtanilag helyes magyar kérdés a kijelölt
  részlet EGY konkrét tényéről.
- A kérdést semleges, harmadik személyű megfogalmazásban tedd fel —
  nevezd meg a szereplőt, ne idézd a szöveg első személyét (pl. "Isten
  minek a jeléül helyezte az ívét a felhőkbe?", ne "közöttem").
- A válasz TÖMÖR (néhány szó), és pontosan a szövegből következzen —
  ne találj ki semmit, ami nincs benne.
- Az "answer_alt" 0-2 elfogadható alternatív megfogalmazás (pl. szám
  számjeggyel és betűvel).
- Válaszolj KIZÁRÓLAG ezzel a JSON formával:
  {"question": "...", "answer": "...", "answer_alt": ["..."]}`;

/** Drafts a question + answer from a selected scripture excerpt; the user
 * edits both before saving. Never writes anything itself. */
export async function suggestCard(input: { text: string; verseRef: string }): Promise<CardSuggestion> {
  await requireUser();

  const text = input.text.trim().slice(0, 1200);
  if (text.length < 3) throw new Error("empty selection");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SUGGEST_SYSTEM },
      { role: "user", content: `Igehely: ${input.verseRef}\nKijelölt szövegrész: "${text}"` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { question?: unknown; answer?: unknown; answer_alt?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid AI response");
  }
  const question = typeof parsed.question === "string" ? parsed.question.trim() : "";
  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  if (!question || !answer) throw new Error("invalid AI response");
  const answer_alt = Array.isArray(parsed.answer_alt)
    ? parsed.answer_alt.filter((a): a is string => typeof a === "string" && a.trim().length > 0).slice(0, 2)
    : [];

  return { question, answer, answer_alt };
}

export async function markDayRead(day_idx: number, minutes: number) {
  const supabase = await requireUser();
  const { error } = await supabase.from("reading_log").upsert({
    day_idx,
    completed_at: new Date().toISOString(),
    minutes,
  });
  if (error) throw error;
  revalidatePath("/olvasas");
  await checkAndAwardBadges(supabase);
}
