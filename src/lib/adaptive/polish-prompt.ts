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
  /** The deterministic template text — clumsy but always directionally correct,
   * and by construction never contains the answer. Sent to the model as the
   * anchor to REPHRASE (not re-derive), which stops it from inverting
   * reverse questions. */
  promptRaw: string | null;
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

Kártyatípusonkénti KÖTELEZŐ irány:
- "reverse": a válasz egy személy/hely/dolog NEVE. A kérdés KI / MELYIK /
  KINEK / MINEK formában kérdezzen rá az entitásra, és a kapott
  fact_value-t ÉPÍTSD BE a kérdésbe azonosító adatként (pl. fact_key
  "folyók száma", fact_value "4" → "Melyik helynek volt 4 folyója?").
  SOHA ne kérdezz rá magára az értékre — az nem a válasz.
- "recall" / "numeric" / "mcq": a válasz az érték. A kérdésben KÖTELEZŐEN
  szerepeljen az entity_name (megfelelő raggal), és az értékre kérdezz rá
  (pl. "Hány éves volt Nóé, amikor…?"). Alany nélküli kérdés érvénytelen.

- Válaszolj KIZÁRÓLAG ezzel a JSON formával: {"results": {"<card_id>": "<kérdés>"}}`;

function contextFor(item: PolishItem): Record<string, unknown> {
  if (item.cardType === "reverse") {
    // The answer for `reverse` cards is the entity name — withhold it.
    return {
      card_id: item.cardId,
      card_type: item.cardType,
      raw_template: item.promptRaw,
      fact_key: item.factKey,
      fact_value: item.factValue,
      unit: item.unit,
    };
  }
  // recall / numeric / mcq (incl. contrast-tagged): the answer is the fact value — withhold it.
  return {
    card_id: item.cardId,
    card_type: item.cardType,
    raw_template: item.promptRaw,
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
      content: `Fogalmazd át ezeket a kérdésváz-objektumokat. A "raw_template" a nyers gépi kérdés — ez ügyetlen megfogalmazású, de az IRÁNYA helyes: ugyanarra kérdez rá, amire neked is kell. Csak fogalmazd át gördülékeny magyarra, az irányát tartsd meg. A "fact_key" a nyers, alávonásokkal tagolt mezőnév (pl. "kora_első_fia_születésekor" = "hány éves volt, amikor megszületett az első fia").\n\n${JSON.stringify(payload, null, 2)}`,
    },
  ];
}

const NUMERIC_VALUE = /^\d+([.,]\d+)?$/;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lowercase + strip diacritics, so Hungarian suffix vowel-lengthening
 * ("bárka" → "bárkának") doesn't defeat substring stem matching. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Structural validation of a polished question against its card's context.
 * Beyond the basic shape/leak checks, this enforces question DIRECTION —
 * the class of bug where the model asks for the value when the answer is
 * the entity ("Hány folyója van?" with answer "Éden"), which shape checks
 * alone can never catch:
 * - reverse: the fact value is the identifying clue and must appear in the
 *   question (numeric values matched on digit boundaries so "4" can't
 *   accidentally match "40-ben"); and since the answer is a NAME, a
 *   question opening with "hány/mennyi" is asking in the wrong direction.
 * - recall/numeric/mcq: the entity must be named — a subject-less question
 *   is unanswerable. Matched on the name's first-word stem so Hungarian
 *   suffixed forms ("Édennek", "Nóéval") still pass.
 */
export function validatePolishedQuestion(item: PolishItem, question: string): boolean {
  if (!question || question.length > 200 || !question.endsWith("?")) return false;

  const lowerQuestion = question.toLowerCase();
  const leakCandidates = [item.answer, ...item.answerAlt].filter((a) => a && a.length >= 2);
  if (leakCandidates.some((a) => lowerQuestion.includes(a.toLowerCase()))) return false;

  if (item.cardType === "reverse") {
    // The fact value is the identifying clue and must appear in the question —
    // but long compound values ("6 nap alkotás + 1 nap pihenés") can't be
    // required verbatim, so we check the value's core: its leading number
    // (digit-boundary matched so "4" can't hide in "40"), else its head word.
    const value = (item.factValue ?? "").trim();
    const numMatch = value.match(/\d+([.,]\d+)?/);
    if (numMatch) {
      const boundary = new RegExp(`(^|\\D)${escapeRegExp(numMatch[0])}(\\D|$)`);
      if (!boundary.test(question)) return false;
    } else {
      const headWord = value.split(/\s+/)[0]?.replace(/[^\p{L}\p{N}]/gu, "") ?? "";
      if (headWord.length >= 3 && !fold(question).includes(fold(headWord))) return false;
    }
    if (!NUMERIC_VALUE.test(item.answer.trim()) && /^\s*(hány|mennyi)\b/i.test(question)) return false;
    return true;
  }

  // recall / numeric / mcq — the question must name its subject.
  const firstWord = (item.entityName ?? "").trim().split(/\s+/)[0]?.replace(/[^\p{L}\p{N}]/gu, "") ?? "";
  if (firstWord.length >= 3 && !fold(question).includes(fold(firstWord))) return false;
  return true;
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
    if (!validatePolishedQuestion(item, question)) continue;

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
