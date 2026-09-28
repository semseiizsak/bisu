import { test } from "node:test";
import assert from "node:assert/strict";
import { answerLeaks, validateChapterQuestions, verseRefMatchesChapter, shuffleOptions, type RawQuestion } from "./questions";

const ctx = { bookShort: "1Móz", chapter: 4 };

function q(over: Partial<RawQuestion> = {}): RawQuestion {
  return {
    kind: "narrative",
    question: "Miért nem tekintett Isten Kain áldozatára?",
    answer: "Mert a szíve nem volt igaz",
    answer_alt: ["Kain nem jól cselekedett"],
    distractors: ["Mert növényt hozott", "Mert későn vitte", "Mert Ábel többet hozott"],
    why: "Az áldozat értékét a szív adja.",
    verse_ref: "1Móz 4:5-7",
    difficulty: 3,
    ...over,
  };
}

test("accepts a well-formed question", () => {
  const r = validateChapterQuestions([q()], ctx);
  assert.equal(r.accepted.length, 1);
  assert.equal(r.rejected.length, 0);
  assert.deepEqual(r.accepted[0].answer_alt, ["Kain nem jól cselekedett"]);
});

test("rejects a question that leaks its answer", () => {
  const r = validateChapterQuestions([q({ question: "Kit ölt meg Kain a mezőn, Ábelt?", answer: "Ábel" })], ctx);
  assert.equal(r.accepted.length, 0);
  assert.equal(r.rejected[0].reason, "answer leaks into question");
});

test("numeric leak is caught both as digits and as a number word", () => {
  assert.equal(answerLeaks("Hány napig esett az eső, 40 napig?", "40"), true);
  assert.equal(answerLeaks("Hány napja volt a teremtés hat napjának?", "6"), true);
  assert.equal(answerLeaks("Hány napig esett az eső?", "40"), false);
  assert.equal(answerLeaks("Mi történt a 400. évben?", "40"), false);
});

test("suffixed name still counts as a leak", () => {
  assert.equal(answerLeaks("Mit mondott Isten Kainnak?", "Kain"), true);
});

test("rejects verse refs outside the chapter", () => {
  assert.equal(verseRefMatchesChapter("1Móz 4:9", ctx), true);
  assert.equal(verseRefMatchesChapter("1Móz 5:9", ctx), false);
  assert.equal(verseRefMatchesChapter("Ruth 4:9", ctx), false);
  const r = validateChapterQuestions([q({ verse_ref: "1Móz 5:1" })], ctx);
  assert.equal(r.rejected[0].reason, "verse_ref outside chapter");
});

test("distractors must be the same kind as the answer and unique", () => {
  const mixed = q({ kind: "number", answer: "40", distractors: ["Sém", "30", "40"] });
  const r = validateChapterQuestions([mixed], ctx);
  assert.equal(r.accepted.length, 0);
  assert.equal(r.rejected[0].reason, "fewer than 3 usable distractors");
});

test("only one number question per chapter", () => {
  const a = q({ kind: "number", question: "Hány napig esett az eső?", answer: "40", distractors: ["30", "50", "70"], verse_ref: "1Móz 4:1" });
  const b = q({ kind: "number", question: "Hány évig élt Ádám?", answer: "930", distractors: ["912", "905", "969"], verse_ref: "1Móz 4:2" });
  const r = validateChapterQuestions([a, b], ctx);
  assert.equal(r.accepted.length, 1);
  assert.equal(r.rejected[0].reason, "number question cap");
});

test("caps at six and keeps story questions over the number question", () => {
  const items: RawQuestion[] = [];
  items.push(q({ kind: "number", question: "Hány napig tartott az eső?", answer: "40", distractors: ["30", "50", "70"], verse_ref: "1Móz 4:1" }));
  for (let i = 0; i < 7; i++) {
    items.push(q({ question: `Mi történt a ${i + 1}. versben az Úr szava után?`, answer: `Válasz ${i}`, distractors: [`X${i}`, `Y${i}`, `Z${i}`], verse_ref: `1Móz 4:${i + 2}` }));
  }
  const r = validateChapterQuestions(items, ctx);
  assert.equal(r.accepted.length, 6);
  assert.ok(r.accepted.every((x) => x.kind !== "number"));
});

test("duplicate answers are dropped", () => {
  const r = validateChapterQuestions([q(), q({ question: "Mi volt Kain áldozatának baja?" })], ctx);
  assert.equal(r.accepted.length, 1);
  assert.equal(r.rejected[0].reason, "duplicate answer");
});

test("rejects non-self-contained questions", () => {
  const r = validateChapterQuestions([q({ question: "Mi történt ebben a fejezetben Kainnal?" })], ctx);
  assert.equal(r.rejected[0].reason, "not self-contained");
});

test("option shuffle is deterministic and keeps all options", () => {
  const a = shuffleOptions("A", ["B", "C", "D"], 42);
  const b = shuffleOptions("A", ["B", "C", "D"], 42);
  assert.deepEqual(a, b);
  assert.deepEqual([...a].sort(), ["A", "B", "C", "D"]);
});
