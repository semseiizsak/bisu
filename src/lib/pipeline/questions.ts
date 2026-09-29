import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ERA_ORDER } from "@/lib/content/eras";
import { QUESTION_KINDS, type QuestionKind } from "@/lib/content/card-payloads";

type DB = SupabaseClient<Database>;

// Shared between the Next.js route handler and the tsx CLI script, so no
// "server-only" import here; both call sites inject their own clients.

export const DEFAULT_QUESTION_MODEL = "gpt-4o";
export const MAX_QUESTIONS_PER_CHAPTER = 6;
export const MIN_QUESTIONS_PER_CHAPTER = 2;
const MAX_NUMBER_QUESTIONS = 1;

export function questionModel(): string {
  return process.env.OPENAI_QUESTION_MODEL?.trim() || DEFAULT_QUESTION_MODEL;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Egy bibliaolvasó program szerkesztője vagy. A feladatod: egy frissen
elolvasott fejezethez (Károli-fordítás) egy rövid tanulmányi jegyzetet és
néhány valóban érdemes kvízkérdést készíteni magyarul.

A CÉL nem a lexikai adatok bemagoltatása, hanem hogy az olvasó egy év múlva
is emlékezzen arra, MI történt, KI tette, MIÉRT, és MIT jelent. Úgy kérdezz,
ahogy egy jó bibliatanár kérdezne a csoportjától a fejezet elolvasása után.

MIT KÉRDEZZ (ebben a fontossági sorrendben):
1. narrative — a történet fordulópontjai: mi történt, mi volt az ok, mi lett a
   következmény ("Miért utasította el Isten Kain áldozatát?").
2. person — ki tette / ki mondta / kinek szólt, és mi jellemezte.
3. saying — emlékezetes mondás, ígéret, parancs ("Mit felelt Kain, amikor
   Isten Ábel felől kérdezte?").
4. theme — a szakasz üzenete, tanítása, egy fogalom jelentése.
5. place — hol történt, ha a helynek jelentősége van a történetben.
6. number — LEGFELJEBB EGY, és csak ha a szám önmagában emlékezetes és
   jelentős (pl. 40 nap eső, 12 törzs, 3 nap). Életkorok, méretek, létszámok,
   nemzetségtáblázati adatok NEM kérdezhetők.

MIT NE KÉRDEZZ:
- "Hány éves volt X, amikor…", méretek singben, hány fia volt, ki kinek volt
  az apja hosszú nemzetségtáblázatokból.
- Olyat, amire a fejezet nem ad egyértelmű választ.
- Olyat, amit a kérdés szövege maga elárul.
- Két kérdést ugyanarra a tényre.

NEHÉZSÉG — ez a legfontosabb:
- A kérdések LEGALÁBB FELE legyen olyan, amit csak a fejezet FIGYELMES
  olvasója tud megválaszolni (difficulty 3–5): konkrét részlet, indok,
  sorrend, pontos megfogalmazás, mi történt közvetlenül ezután.
- Fejezetenként legfeljebb EGY difficulty 1-es "vasárnapi iskolai" alapkérdés
  (pl. "Ki ölte meg Ábelt?"). Amit bárki tud olvasás nélkül, az nem ér semmit.
- Ha a szakasz közismert (teremtés, bűneset, özönvíz), a kevésbé ismert
  részletekre kérdezz: mit mondott pontosan, milyen sorrendben, mi volt a
  feltétel, mit tett utána.

KÉRDÉSEK FORMÁJA:
- Önállóan érthető, nevezze meg a szereplőt/könyvet — SOHA ne írd, hogy
  "ebben a fejezetben".
- Természetes, nyelvtanilag helyes magyar, egy mondat, kérdőjellel.
- A helyes válasz RÖVID (legfeljebb 8 szó), egyértelmű, a szövegből következik.
- answer_alt: 0–3 elfogadható alternatív megfogalmazás (rövidebb/hosszabb
  alak, szám betűvel), üres tömb is lehet.
- distractors: PONTOSAN 3 hamis válasz, amelyek UGYANOLYAN FAJTÁJÚAK, mint a
  helyes válasz (személy mellé személyek, hely mellé helyek, cselekedet mellé
  cselekedetek, szám mellé közeli számok). A hamis válaszok VALÓS elemek
  legyenek ugyanabból a fejezetből vagy a szomszédos történetből (más
  szereplő tette, más helyen hangzott el, más okból történt) — ne kitalált,
  a szövegben elő sem forduló mondatok. Ugyanolyan hosszúak és ugyanolyan
  stílusúak legyenek, mint a helyes válasz, hogy a forma ne árulja el.
  Annak, aki csak félig emlékszik, mindhárom legyen csábító. Sose legyen
  abszurd vagy nyilvánvalóan kizárható.
- why: EGY mondat, ami a válasz után megjelenik: miért fontos ez, mihez
  kapcsolódik, mit jelent — ez adja a mélységet.
- verse_ref: a fejezeten belüli igehely, pl. "1Móz 4:9" vagy "1Móz 4:9-10".
- difficulty: 1 (bárki tudja) … 5 (csak figyelmes olvasó).

MENNYISÉG: gazdag elbeszélő fejezethez 5–6 kérdés, átlagos fejezethez 4,
nemzetségtáblázat / tiszta felsorolás fejezethez 2–3. Soha ne tölts ki
kvótát gyenge kérdéssel.

TANULMÁNYI JEGYZET (study):
- summary: 3–4 mondat, mi történik a fejezetben, elbeszélő sorrendben.
- context: 2–3 mondat: hol áll ez a fejezet a könyv és az üdvtörténet
  ívében, mi előzi meg, mire készít elő.
- key_verse_ref + key_verse_why: a fejezet egy kulcsverse és egy mondat,
  miért az.
- cross_refs: 2–3 más bibliai hely, ami erre a fejezetre épül vagy
  megvilágítja (pl. Újszövetségi visszautalás), egy-egy mondattal.
- themes: 2–4 rövid kulcsszó.

IDŐVONAL ÉS NEMZETSÉG (a játékokhoz, mellékesen):
- events: 0–3 főesemény, ha a fejezet tartalmaz ilyet, korszakkal a listából:
  ${ERA_ORDER.join(", ")}.
- genealogy: a fejezetben kifejezetten kimondott szülő→gyermek párok
  (legfeljebb 10), a nemzetség rövid nevével (line, pl. "sét", "ábrahám").
  Ha nincs, üres tömb.

Kizárólag a megadott JSON-sémának megfelelő választ adj.`;

const FEW_SHOT_EXAMPLE = `Példa a minőségre (Mózes első könyve 4 alapján, csak illusztráció):
{
  "questions": [
    {
      "kind": "narrative",
      "question": "Miért nem tekintett Isten Kain áldozatára?",
      "answer": "Mert Kain szíve nem volt igaz",
      "answer_alt": ["Kain nem jól cselekedett", "a szíve miatt"],
      "distractors": ["Mert növényt hozott, nem állatot", "Mert későn vitte az áldozatot", "Mert Ábel többet hozott"],
      "why": "A szöveg Kain haragját és Isten figyelmeztetését hangsúlyozza: az áldozat értékét a szív állapota adja, nem az anyaga (vö. Zsid 11:4).",
      "verse_ref": "1Móz 4:5-7",
      "difficulty": 3
    },
    {
      "kind": "saying",
      "question": "Mit felelt Kain, amikor Isten megkérdezte, hol van Ábel?",
      "answer": "Avagy őrizője vagyok-é én az én atyámfiának?",
      "answer_alt": ["Őrizője vagyok-e a testvéremnek?", "nem tudom, őrzője vagyok-e"],
      "distractors": ["Nem tudom, elment a mezőre", "Az Úr tudja, hol van", "Ábel megharagudott rám"],
      "why": "Ez a mondat lett a testvéri felelősség elhárításának örök jelképe.",
      "verse_ref": "1Móz 4:9",
      "difficulty": 2
    }
  ]
}`;

// ---------------------------------------------------------------------------
// Structured output schema
// ---------------------------------------------------------------------------

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["study", "questions", "events", "genealogy"],
  properties: {
    study: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "context", "key_verse_ref", "key_verse_why", "cross_refs", "themes"],
      properties: {
        summary: { type: "string" },
        context: { type: "string" },
        key_verse_ref: { type: "string" },
        key_verse_why: { type: "string" },
        cross_refs: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["ref", "why"],
            properties: { ref: { type: "string" }, why: { type: "string" } },
          },
        },
        themes: { type: "array", items: { type: "string" } },
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "question", "answer", "answer_alt", "distractors", "why", "verse_ref", "difficulty"],
        properties: {
          kind: { type: "string", enum: [...QUESTION_KINDS] },
          question: { type: "string" },
          answer: { type: "string" },
          answer_alt: { type: "array", items: { type: "string" } },
          distractors: { type: "array", items: { type: "string" } },
          why: { type: "string" },
          verse_ref: { type: "string" },
          difficulty: { type: "integer" },
        },
      },
    },
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label_hu", "era", "verse_ref"],
        properties: {
          label_hu: { type: "string" },
          era: { type: "string", enum: [...ERA_ORDER] },
          verse_ref: { type: "string" },
        },
      },
    },
    genealogy: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["parent", "child", "line", "verse_ref"],
        properties: {
          parent: { type: "string" },
          child: { type: "string" },
          line: { type: "string" },
          verse_ref: { type: "string" },
        },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawQuestion {
  kind: string;
  question: string;
  answer: string;
  answer_alt: string[];
  distractors: string[];
  why: string;
  verse_ref: string;
  difficulty: number;
}

export interface RawStudy {
  summary: string;
  context: string;
  key_verse_ref: string;
  key_verse_why: string;
  cross_refs: { ref: string; why: string }[];
  themes: string[];
}

export interface RawChapterContent {
  study: RawStudy;
  questions: RawQuestion[];
  events: { label_hu: string; era: string; verse_ref: string }[];
  genealogy: { parent: string; child: string; line: string; verse_ref: string }[];
}

export interface ValidQuestion {
  kind: QuestionKind;
  question: string;
  answer: string;
  answer_alt: string[];
  distractors: string[];
  why: string;
  verse_ref: string;
  difficulty: number;
}

export interface ChapterContext {
  /** Book abbreviation as used in verse refs, e.g. "1Móz". */
  bookShort: string;
  chapter: number;
}

export interface ValidationReport {
  accepted: ValidQuestion[];
  rejected: { question: RawQuestion; reason: string }[];
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export function buildChapterMessages(
  bookName: string,
  bookShort: string,
  chapter: number,
  verses: { verse: number; text: string }[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const versesText = verses.map((v) => `${v.verse} ${v.text}`).join("\n");
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `${FEW_SHOT_EXAMPLE}\n\nMost ehhez a fejezethez dolgozz. Az igehelyekhez ezt a rövidítést használd: "${bookShort} ${chapter}:<vers>".\n\nKönyv: ${bookName} (${bookShort}), ${chapter}. fejezet\n\n${versesText}`,
    },
  ];
}

export async function generateChapterContent(
  openai: OpenAI,
  bookName: string,
  bookShort: string,
  chapter: number,
  verses: { verse: number; text: string }[],
  model: string = questionModel(),
): Promise<RawChapterContent> {
  const completion = await openai.chat.completions.create({
    model,
    // Newer reasoning models reject a temperature parameter; only the
    // gpt-4 family takes it.
    ...(model.startsWith("gpt-4") ? { temperature: 0.4 } : {}),
    response_format: {
      type: "json_schema",
      json_schema: { name: "chapter_content", strict: true, schema: RESPONSE_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: buildChapterMessages(bookName, bookShort, chapter, verses),
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("empty completion");
  return JSON.parse(text) as RawChapterContent;
}

// ---------------------------------------------------------------------------
// Validation (pure)
// ---------------------------------------------------------------------------

export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NUMERIC = /^\d+([.,]\d+)?$/;
const isNumeric = (s: string) => NUMERIC.test(s.trim());

/** Diacritic-folded Hungarian numerals so "hat" gives away 6 as much as "6" does. */
const NUMBER_WORDS: Record<string, string[]> = {
  "1": ["egy"],
  "2": ["ket", "ketto"],
  "3": ["harom"],
  "4": ["negy"],
  "5": ["ot"],
  "6": ["hat"],
  "7": ["het"],
  "8": ["nyolc"],
  "9": ["kilenc"],
  "10": ["tiz"],
  "12": ["tizenket", "tizenketto"],
  "40": ["negyven"],
  "70": ["hetven"],
  "100": ["szaz"],
  "1000": ["ezer"],
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when the question text gives away the answer. */
export function answerLeaks(question: string, answer: string): boolean {
  const q = fold(question);
  const a = fold(answer);
  if (!a) return false;
  if (isNumeric(answer)) {
    const digits = answer.trim();
    if (new RegExp(`(^|\\D)${escapeRegExp(digits)}(\\D|$)`).test(question)) return true;
    const words = NUMBER_WORDS[digits] ?? [];
    return words.some((w) => new RegExp(`(^|\\s)${w}`).test(q));
  }
  if (a.length < 3) return false;
  // Whole answer as a phrase, or (for short answers) as a word prefix so
  // "Kain" is caught inside "Kainnak".
  if (q.includes(a)) return true;
  const words = a.split(" ");
  if (words.length === 1 && a.length >= 4) return new RegExp(`(^|\\s)${escapeRegExp(a)}`).test(q);
  return false;
}

const REF_RE = /^(\S+)\s+(\d+):(\d+)(?:-(\d+))?$/;

export function verseRefMatchesChapter(ref: string, ctx: ChapterContext): boolean {
  const m = ref.trim().match(REF_RE);
  if (!m) return false;
  return fold(m[1]) === fold(ctx.bookShort) && Number(m[2]) === ctx.chapter;
}

function cleanString(s: unknown, max: number): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/**
 * Filters the model's questions down to the ones worth putting in front of a
 * learner. Rejects leaks, ambiguous or mismatched distractors, out-of-chapter
 * references, duplicate answers, and caps number questions at one.
 */
export function validateChapterQuestions(raw: RawQuestion[], ctx: ChapterContext): ValidationReport {
  const accepted: ValidQuestion[] = [];
  const rejected: ValidationReport["rejected"] = [];
  const seenAnswers = new Set<string>();
  const seenQuestions = new Set<string>();
  let numberCount = 0;

  for (const q of raw ?? []) {
    const reject = (reason: string) => rejected.push({ question: q, reason });

    const kind = q.kind as QuestionKind;
    if (!QUESTION_KINDS.includes(kind)) {
      reject("unknown kind");
      continue;
    }
    const question = cleanString(q.question, 240);
    const answer = cleanString(q.answer, 80);
    const why = cleanString(q.why, 320);
    const verseRef = cleanString(q.verse_ref, 32);

    if (question.length < 12 || !question.endsWith("?")) {
      reject("question shape");
      continue;
    }
    if (!answer) {
      reject("empty answer");
      continue;
    }
    if (/ebben a fejezetben|a fejezet(ben|ből)/i.test(question)) {
      reject("not self-contained");
      continue;
    }
    if (answerLeaks(question, answer)) {
      reject("answer leaks into question");
      continue;
    }
    if (!verseRefMatchesChapter(verseRef, ctx)) {
      reject("verse_ref outside chapter");
      continue;
    }

    const answerFold = fold(answer);
    if (seenAnswers.has(answerFold)) {
      reject("duplicate answer");
      continue;
    }
    const questionFold = fold(question);
    if (seenQuestions.has(questionFold)) {
      reject("duplicate question");
      continue;
    }

    const numericAnswer = isNumeric(answer);
    const distractorSeen = new Set<string>([answerFold]);
    const distractors: string[] = [];
    for (const d of q.distractors ?? []) {
      const clean = cleanString(d, 80);
      if (!clean) continue;
      const f = fold(clean);
      if (distractorSeen.has(f)) continue;
      if (isNumeric(clean) !== numericAnswer) continue;
      distractorSeen.add(f);
      distractors.push(clean);
    }
    if (distractors.length < 3) {
      reject("fewer than 3 usable distractors");
      continue;
    }

    if (kind === "number") {
      if (numberCount >= MAX_NUMBER_QUESTIONS) {
        reject("number question cap");
        continue;
      }
      numberCount++;
    }

    const answerAlt = Array.from(
      new Set(
        (q.answer_alt ?? [])
          .map((a) => cleanString(a, 80))
          .filter((a) => a && fold(a) !== answerFold),
      ),
    ).slice(0, 3);

    const difficulty = Number.isFinite(q.difficulty) ? Math.min(5, Math.max(1, Math.round(q.difficulty))) : 3;

    seenAnswers.add(answerFold);
    seenQuestions.add(questionFold);
    accepted.push({ kind, question, answer, answer_alt: answerAlt, distractors: distractors.slice(0, 3), why, verse_ref: verseRef, difficulty });
  }

  // Keep the model's order (it leads with the strongest questions) but never
  // let a number question crowd out a story question at the cap.
  const nonNumber = accepted.filter((q) => q.kind !== "number");
  const number = accepted.filter((q) => q.kind === "number");
  const capped = [...nonNumber, ...number].slice(0, MAX_QUESTIONS_PER_CHAPTER);
  const dropped = accepted.filter((q) => !capped.includes(q));
  for (const q of dropped) rejected.push({ question: q, reason: "per-chapter cap" });

  return { accepted: capped, rejected };
}

/** Deterministic option order so a card looks the same on every load. */
export function shuffleOptions(answer: string, distractors: string[], seed: number): string[] {
  const options = [answer, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const x = Math.sin(seed * 9301 + i * 49297) * 233280;
    const j = Math.floor((x - Math.floor(x)) * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Loading into the DB
// ---------------------------------------------------------------------------

export interface LoadResult {
  cardsCreated: number;
  cardsSkipped: number;
  noteSaved: boolean;
  eventsCreated: number;
  edgesCreated: number;
}

export async function loadChapterContent(
  admin: DB,
  book: { id: number; slug: string; short_hu: string; order_idx: number },
  chapter: number,
  raw: RawChapterContent,
  model: string,
): Promise<LoadResult & { report: ValidationReport }> {
  const ctx: ChapterContext = { bookShort: book.short_hu, chapter };
  const report = validateChapterQuestions(raw.questions, ctx);

  const result: LoadResult = { cardsCreated: 0, cardsSkipped: 0, noteSaved: false, eventsCreated: 0, edgesCreated: 0 };

  // --- study note ----------------------------------------------------------
  const study = raw.study;
  if (study && cleanString(study.summary, 2000)) {
    const { error } = await admin.from("chapter_notes").upsert(
      {
        book_id: book.id,
        chapter,
        summary: cleanString(study.summary, 2000),
        context: cleanString(study.context, 2000),
        key_verse_ref: cleanString(study.key_verse_ref, 32) || null,
        key_verse_why: cleanString(study.key_verse_why, 500) || null,
        cross_refs: (study.cross_refs ?? [])
          .map((c) => ({ ref: cleanString(c.ref, 40), why: cleanString(c.why, 300) }))
          .filter((c) => c.ref)
          .slice(0, 4),
        themes: (study.themes ?? []).map((t) => cleanString(t, 40)).filter(Boolean).slice(0, 5),
        model,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "book_id,chapter" },
    );
    if (error) throw error;
    result.noteSaved = true;
  }

  // --- question cards (idempotent per chapter by folded question text) -----
  const { data: existing } = await admin.from("cards").select("prompt").eq("type", "question").eq("book_id", book.id).eq("chapter", chapter);
  const existingPrompts = new Set((existing ?? []).map((c) => fold(c.prompt)));

  const rows = report.accepted
    .filter((q) => {
      const dup = existingPrompts.has(fold(q.question));
      if (dup) result.cardsSkipped++;
      return !dup;
    })
    .map((q) => ({
      type: "question",
      kind: q.kind,
      prompt: q.question,
      prompt_raw: q.question,
      answer: q.answer,
      answer_alt: q.answer_alt,
      distractors: q.distractors,
      payload: { kind: q.kind, options: shuffleOptions(q.answer, q.distractors, hashString(q.question)), why: q.why },
      book_id: book.id,
      chapter,
      verse_ref: q.verse_ref,
      difficulty: q.difficulty,
      tags: [],
      source: "generated",
      active: true,
    }));

  if (rows.length) {
    const { data: inserted, error } = await admin.from("cards").insert(rows).select("id");
    if (error) throw error;
    const now = new Date().toISOString();
    const states = (inserted ?? []).map((c) => ({ card_id: c.id, state: 0, due_at: now, reps: 0, lapses: 0, suspended: false }));
    if (states.length) {
      const { error: stateError } = await admin.from("card_states").insert(states);
      if (stateError) throw stateError;
    }
    result.cardsCreated = rows.length;
  }

  // --- timeline events (game content) ---------------------------------------
  const events = (raw.events ?? [])
    .filter((e) => (ERA_ORDER as readonly string[]).includes(e.era) && cleanString(e.label_hu, 120))
    .slice(0, 3);
  if (events.length) {
    const { data: existingEvents } = await admin.from("timeline_events").select("label_hu");
    const known = new Set((existingEvents ?? []).map((e) => fold(e.label_hu)));
    const newEvents = events
      .filter((e) => !known.has(fold(e.label_hu)))
      .map((e, i) => ({
        label_hu: cleanString(e.label_hu, 120),
        era: e.era,
        // canonical position: keeps chunks chronological within an era
        order_idx: book.order_idx * 10000 + chapter * 10 + i,
        verse_ref: cleanString(e.verse_ref, 32) || null,
        importance: 3,
      }));
    if (newEvents.length) {
      const { error } = await admin.from("timeline_events").insert(newEvents);
      if (error) console.warn("timeline_events insert warning:", error.message);
      else result.eventsCreated = newEvents.length;
    }
  }

  // --- genealogy edges (game content) ---------------------------------------
  const edges = (raw.genealogy ?? []).filter((g) => cleanString(g.parent, 60) && cleanString(g.child, 60)).slice(0, 10);
  if (edges.length) {
    const { data: entityRows } = await admin.from("entities").select("id, name_hu");
    const entityByName = new Map((entityRows ?? []).map((e) => [e.name_hu, e.id]));
    async function entityId(name: string): Promise<number> {
      const clean = cleanString(name, 60);
      const cached = entityByName.get(clean);
      if (cached) return cached;
      const { data, error } = await admin.from("entities").insert({ type: "person", name_hu: clean, importance: 2 }).select("id").single();
      if (error) throw error;
      entityByName.set(clean, data.id);
      return data.id;
    }
    const { data: existingEdges } = await admin.from("genealogy_edges").select("parent_id, child_id");
    const knownEdges = new Set((existingEdges ?? []).map((e) => `${e.parent_id}:${e.child_id}`));
    const edgeRows: { parent_id: number; child_id: number; line: string; verse_ref: string | null }[] = [];
    for (const g of edges) {
      const parent_id = await entityId(g.parent);
      const child_id = await entityId(g.child);
      if (parent_id === child_id || knownEdges.has(`${parent_id}:${child_id}`)) continue;
      knownEdges.add(`${parent_id}:${child_id}`);
      edgeRows.push({ parent_id, child_id, line: cleanString(g.line, 40) || book.slug, verse_ref: cleanString(g.verse_ref, 32) || null });
    }
    if (edgeRows.length) {
      const { error } = await admin.from("genealogy_edges").insert(edgeRows);
      if (error) console.warn("genealogy_edges insert warning:", error.message);
      else result.edgesCreated = edgeRows.length;
    }
  }

  return { ...result, report };
}
