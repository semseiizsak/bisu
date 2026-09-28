import { test } from "node:test";
import assert from "node:assert/strict";
import { nextDayIndex } from "./current-day";

test("a fresh program starts on day 1", () => {
  assert.equal(nextDayIndex(null), 1);
  assert.equal(nextDayIndex(0), 1);
});

test("the plan resumes right after the last completed day, whatever the calendar says", () => {
  assert.equal(nextDayIndex(17), 18);
});

test("the plan never runs past its last day", () => {
  assert.equal(nextDayIndex(365), 365);
  assert.equal(nextDayIndex(900), 365);
});
