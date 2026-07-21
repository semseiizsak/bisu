import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { CardType } from "@/lib/content/difficulty";
import { calibrateDifficulty } from "@/lib/content/difficulty";
import { numericDistractors, entityDistractors } from "@/lib/content/distractors";

type DB = SupabaseClient<Database>;

const humanizeKey = (key: string) => key.replace(/_/g, " ");

export interface VariantCardDraft {
  type: CardType;
  prompt: string;
  answer: string;
  answer_alt: string[];
  distractors: string[];
  payload: object | null;
  fact_id: number;
  entity_id: number;
  book_id: number | null;
  chapter: number | null;
  verse_ref: string;
  difficulty: number;
  // Extra context (not written to the DB) so callers can polish `prompt` without a second round-trip.
  entityName: string;
  entityType: string;
  factKey: string;
  factValue: string;
  unit: string | null;
}

/** Builds the next-type reformulation of a fact for the adaptive layer (section 10.1). Runs client-side, hitting only read-open content tables. */
export async function buildVariantCard(
  db: DB,
  factId: number,
  targetType: CardType,
): Promise<VariantCardDraft | null> {
  const { data: fact } = await db
    .from("facts")
    .select("id, entity_id, fact_key, fact_value, numeric_val, unit, verse_ref, book_id, chapter, verified, suppressed")
    .eq("id", factId)
    .maybeSingle();
  if (!fact || fact.entity_id == null || !fact.verified || fact.suppressed) return null;

  const { data: entity } = await db
    .from("entities")
    .select("id, type, name_hu, importance, ref_count")
    .eq("id", fact.entity_id)
    .maybeSingle();
  if (!entity) return null;

  const difficulty = calibrateDifficulty({
    entityImportance: entity.importance,
    entityRefCount: entity.ref_count,
    numericVal: fact.numeric_val,
    type: targetType,
  });

  const base = {
    fact_id: fact.id,
    entity_id: entity.id,
    book_id: fact.book_id,
    chapter: fact.chapter,
    verse_ref: fact.verse_ref,
    difficulty,
    entityName: entity.name_hu,
    entityType: entity.type,
    factKey: fact.fact_key,
    factValue: fact.fact_value,
    unit: fact.unit,
  };

  if (targetType === "recall") {
    return { ...base, type: "recall", prompt: `Mi volt ${entity.name_hu} ${humanizeKey(fact.fact_key)}?`, answer: fact.fact_value, answer_alt: [], distractors: [], payload: null };
  }

  if (targetType === "reverse") {
    return { ...base, type: "reverse", prompt: `Kinek/minek volt ${fact.fact_value} a(z) ${humanizeKey(fact.fact_key)}?`, answer: entity.name_hu, answer_alt: [], distractors: [], payload: null };
  }

  if (targetType === "numeric") {
    if (fact.numeric_val == null) return null;
    return {
      ...base,
      type: "numeric",
      prompt: `Hány ${fact.unit ?? ""}? ${entity.name_hu} — ${humanizeKey(fact.fact_key)}`.trim(),
      answer: String(fact.numeric_val),
      answer_alt: [],
      distractors: [],
      payload: { unit: fact.unit },
    };
  }

  if (targetType === "cloze") {
    if (fact.book_id == null || fact.chapter == null) return null;
    const { data: verses } = await db.from("verses").select("id, text, verse").eq("book_id", fact.book_id).eq("chapter", fact.chapter);
    const match = (verses ?? []).find((v) => v.text.includes(entity.name_hu));
    if (!match) return null;
    return {
      ...base,
      type: "cloze",
      prompt: match.text.replace(entity.name_hu, "_____"),
      answer: entity.name_hu,
      answer_alt: [],
      distractors: [],
      payload: { full_verse: match.text },
    };
  }

  if (targetType === "mcq") {
    let options: string[];
    const numericVal = fact.numeric_val;
    if (numericVal != null) {
      const { data: pool } = await db.from("facts").select("numeric_val").eq("book_id", fact.book_id ?? -1).not("numeric_val", "is", null);
      const poolValues = (pool ?? []).map((p) => p.numeric_val as number);
      const distractors = numericDistractors(numericVal, poolValues, fact.id);
      options = [String(numericVal), ...distractors.map(String)];
    } else {
      const { data: pool } = await db.from("entities").select("id, type, name_hu").eq("type", entity.type).neq("id", entity.id).limit(30);
      const distractors = entityDistractors(entity, [...(pool ?? []), entity], undefined, fact.id);
      if (distractors.length < 3) return null;
      options = [fact.fact_value, ...distractors.map((d) => d.name_hu)];
    }
    const answer = fact.numeric_val != null ? String(fact.numeric_val) : fact.fact_value;
    return {
      ...base,
      type: "mcq",
      prompt: `Mi volt ${entity.name_hu} ${humanizeKey(fact.fact_key)}?`,
      answer,
      answer_alt: [],
      distractors: options.filter((o) => o !== answer),
      payload: { options },
    };
  }

  return null;
}
