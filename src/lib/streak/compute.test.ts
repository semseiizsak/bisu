import { test } from "node:test";
import assert from "node:assert/strict";
import { streakFromDays } from "./compute";

const now = new Date("2026-09-28T12:00:00Z");

test("no activity means no streak", () => {
  assert.deepEqual(streakFromDays(new Set(), now), { current: 0, longest: 0 });
});

test("a run ending today counts, and yesterday keeps it alive", () => {
  assert.deepEqual(streakFromDays(new Set(["2026-09-26", "2026-09-27", "2026-09-28"]), now), { current: 3, longest: 3 });
  assert.deepEqual(streakFromDays(new Set(["2026-09-26", "2026-09-27"]), now), { current: 2, longest: 2 });
});

test("a gap resets current but keeps the longest", () => {
  const days = new Set(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-28"]);
  assert.deepEqual(streakFromDays(days, now), { current: 1, longest: 4 });
});

test("two days of silence ends the current streak", () => {
  assert.deepEqual(streakFromDays(new Set(["2026-09-24", "2026-09-25"]), now), { current: 0, longest: 2 });
});
