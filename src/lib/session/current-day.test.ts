import { test } from "node:test";
import assert from "node:assert/strict";
import { nextDayIndex, localDate } from "./current-day";

const now = new Date("2026-09-29T08:30:00Z"); // 10:30 in Budapest

test("a fresh program starts on day 1", () => {
  assert.equal(nextDayIndex(null), 1);
  assert.equal(nextDayIndex(0), 1);
});

test("the plan resumes right after the last completed day, whatever the calendar says", () => {
  assert.equal(nextDayIndex(17, "2026-09-01T10:00:00Z", now), 18);
});

test("a day finished today stays today's day until the calendar turns", () => {
  assert.equal(nextDayIndex(1, "2026-09-29T07:55:00Z", now), 1);
  // finished late last night Budapest time (23:30 = 21:30Z on the 28th) → today is day 2
  assert.equal(nextDayIndex(1, "2026-09-28T21:30:00Z", now), 2);
});

test("local date respects the Budapest offset", () => {
  assert.equal(localDate("2026-09-28T22:30:00Z"), "2026-09-29");
  assert.equal(localDate("2026-09-28T21:30:00Z"), "2026-09-28");
});

test("the plan never runs past its last day", () => {
  assert.equal(nextDayIndex(365, "2026-01-01T00:00:00Z", now), 365);
  assert.equal(nextDayIndex(900), 365);
});
