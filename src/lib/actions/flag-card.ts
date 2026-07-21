"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type AdminDB = SupabaseClient<Database>;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
}

async function retireCardsByIds(admin: AdminDB, cardIds: number[]): Promise<void> {
  if (!cardIds.length) return;
  const { error: cardError } = await admin.from("cards").update({ active: false }).in("id", cardIds);
  if (cardError) throw cardError;
  const { error: stateError } = await admin.from("card_states").update({ suspended: true }).in("card_id", cardIds);
  if (stateError) throw stateError;
}

export interface FlagResult {
  /** Null for non-fact cards (cloze/locate/order/chain/map/manual) — only the one card was retired. */
  factKey: string | null;
  factKeyLabel: string | null;
  retired: number;
}

/**
 * "Nem fontos" — retires the underlying FACT, not just one card: up to ~4
 * sibling cards (recall/reverse/numeric/mcq) can share a fact_id, and the
 * adaptive variant engine can regenerate a fact into a new card shape from
 * any still-active sibling, so flagging one card left the "same" question
 * fully able to resurface. This retires every card built from the fact and
 * marks the fact itself suppressed (skipped by all generation paths).
 */
export async function flagCardNotImportant(cardId: number): Promise<FlagResult> {
  await requireUser();
  const admin = createAdminClient();

  const { data: card, error: cardReadError } = await admin.from("cards").select("id, fact_id").eq("id", cardId).maybeSingle();
  if (cardReadError) throw cardReadError;
  if (!card) return { factKey: null, factKeyLabel: null, retired: 0 };

  if (card.fact_id == null) {
    await retireCardsByIds(admin, [cardId]);
    return { factKey: null, factKeyLabel: null, retired: 1 };
  }

  const { data: fact, error: factError } = await admin
    .from("facts")
    .update({ suppressed: true })
    .eq("id", card.fact_id)
    .select("fact_key")
    .maybeSingle();
  if (factError) throw factError;

  const { data: siblings, error: siblingsError } = await admin.from("cards").select("id").eq("fact_id", card.fact_id);
  if (siblingsError) throw siblingsError;
  const siblingIds = (siblings ?? []).map((c) => c.id);
  await retireCardsByIds(admin, siblingIds);

  return {
    factKey: fact?.fact_key ?? null,
    factKeyLabel: fact?.fact_key ? fact.fact_key.replace(/_/g, " ") : null,
    retired: siblingIds.length,
  };
}

export interface SuppressSimilarResult {
  factsRetired: number;
  cardsRetired: number;
}

/**
 * "Minden hasonló elrejtése" — one tap after flagging suppresses every fact
 * sharing the same fact_key (e.g. every patriarch's "age at first son"),
 * including ones extracted in the future (checked by every generation path).
 */
export async function suppressSimilarFacts(factKey: string): Promise<SuppressSimilarResult> {
  await requireUser();
  const admin = createAdminClient();

  const { error: keyError } = await admin.from("suppressed_fact_keys").upsert({ fact_key: factKey });
  if (keyError) throw keyError;

  const { data: facts, error: factsError } = await admin
    .from("facts")
    .select("id")
    .eq("fact_key", factKey)
    .eq("suppressed", false);
  if (factsError) throw factsError;
  const factIds = (facts ?? []).map((f) => f.id);
  if (!factIds.length) return { factsRetired: 0, cardsRetired: 0 };

  let cardsRetired = 0;
  const CHUNK = 200;
  for (let i = 0; i < factIds.length; i += CHUNK) {
    const chunk = factIds.slice(i, i + CHUNK);
    const { error: suppressError } = await admin.from("facts").update({ suppressed: true }).in("id", chunk);
    if (suppressError) throw suppressError;

    const { data: cards, error: cardsError } = await admin.from("cards").select("id").in("fact_id", chunk);
    if (cardsError) throw cardsError;
    const cardIds = (cards ?? []).map((c) => c.id);
    await retireCardsByIds(admin, cardIds);
    cardsRetired += cardIds.length;
  }

  return { factsRetired: factIds.length, cardsRetired };
}
