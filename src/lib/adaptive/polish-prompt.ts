import type OpenAI from "openai";

/**
 * AI phrasing-polish pass (section 5.2 of the original design intent,
 * skipped during the initial build and reinstated after real-device
 * testing showed the deterministic templates produce ungrammatical
 * Hungarian — e.g. "Mi volt Teremtés hat napja napok száma?").
 *
 * Redacts the literal answer from the model's context so it can't leak
 * into the generated question, and validates the response can't contain
 * the answer as a substring before it's ever written to the DB.
 */

export interface PolishItem {
  cardId: number;
  cardType: "recall" | "reverse" | "numeric" | "mcq";
  entityName: string | null;
  entityType: string | null;
  factKey: string;
  factValue: string | null;
  unit: string | null;
  isContrast: boolean;
  answer: string;
  answerAlt: string[];
}

const SYSTEM_PROMPT = `Bibliai kvízkérdéseket fogalmazol át természetes, nyelvtanilag helyes
magyar nyelvre. A bemenet egy nyers, gépi sablonból származó kérdésváz és
a hozzá tartozó kontextus (nem a válasz — azt sosem kapod meg).

Szabályok:
- Egyetlen, világos, természetes magyar kérdést fogalmazz meg soronként.
- NE add meg és NE sugalld a választ a kérdésben.
- NE találj ki új tényt, ne tegyél hozzá értelmezést — csak a meglévő
  információt fogalmazd át helyes nyelvtannal (birtokos ragok, esetek).
- A kérdés kérdőjellel végződjön.
- Tömör maradj — egy mondat, ne magyarázkodj.
- Válaszolj KIZÁRÓLAG ezzel a JSON formával: {"results": {"<card_id>": "<kérdés>"}}`;

function contextFor(item: PolishItem): Record<string, unknown> {
  if (item.cardType === "reverse") {
    // The answer for `reverse` cards is the entity name — withhold it.
    return {
      card_id: item.cardId,
      card_type: item.cardType,
      fact_key: item.factKey,
      fact_value: item.factValue,
      unit: item.unit,
    };
  }
  // recall / numeric / mcq (incl. contrast-tagged): the answer is the fact value — withhold it.
  return {
    card_id: item.cardId,
    card_type: item.cardType,
    entity_name: item.entityName,
    entity_type: item.entityType,
    fact_key: item.factKey,
    unit: item.unit,
    is_contrast: item.isContrast,
  };
}

export function buildPolishMessages(items: PolishItem[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  const payload = items.map(contextFor);
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Fogalmazd át ezeket a kérdésváz-objektumokat. A "fact_key" a nyers, alávonásokkal tagolt mezőnév (pl. "kora_első_fia_születésekor" = "hány éves volt, amikor megszületett az első fia"), ebből kell természetes kérdést alkotnod.\n\n${JSON.stringify(payload, null, 2)}`,
    },
  ];
}

export function parsePolishResponse(raw: string, items: PolishItem[]): Map<number, string> {
  const result = new Map<number, string>();
  const byId = new Map(items.map((i) => [i.cardId, i]));

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return result;
  }
  const results = (parsed as { results?: Record<string, unknown> })?.results;
  if (!results || typeof results !== "object") return result;

  for (const [key, value] of Object.entries(results)) {
    const cardId = Number(key);
    const item = byId.get(cardId);
    if (!item || typeof value !== "string") continue;

    const question = value.trim();
    if (!question || question.length > 200 || !question.endsWith("?")) continue;

    const leakCandidates = [item.answer, ...item.answerAlt].filter((a) => a && a.length >= 2);
    const lowerQuestion = question.toLowerCase();
    const leaks = leakCandidates.some((a) => lowerQuestion.includes(a.toLowerCase()));
    if (leaks) continue;

    result.set(cardId, question);
  }
  return result;
}

const MODEL = "gpt-4o-mini";

export async function polishBatch(openai: OpenAI, items: PolishItem[]): Promise<Map<number, string>> {
  if (items.length === 0) return new Map();
  const completion = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: buildPolishMessages(items),
  });
  const text = completion.choices[0]?.message?.content ?? "{}";
  return parsePolishResponse(text, items);
}
