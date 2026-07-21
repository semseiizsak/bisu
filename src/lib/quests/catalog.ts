export type QuestMetric = "srs_count" | "correct_count" | "mcq_count" | "reading_done" | "game_played" | "accuracy_80" | "blitz_perfect";

export interface QuestDef {
  key: string;
  label: (target: number) => string;
  target: number;
  xp: number;
  metric: QuestMetric;
}

/** Fixed catalog — 3 of these rotate in per day, deterministically by day_idx (no AI, no randomness to persist). */
export const QUEST_CATALOG: QuestDef[] = [
  { key: "srs_20", label: (t) => `Válaszolj meg ${t} kártyát`, target: 20, xp: 20, metric: "srs_count" },
  { key: "correct_15", label: (t) => `${t} helyes válasz`, target: 15, xp: 20, metric: "correct_count" },
  { key: "mcq_5", label: (t) => `Válaszolj meg ${t} feleletválasztós kérdést`, target: 5, xp: 15, metric: "mcq_count" },
  { key: "reading_done", label: () => "Olvasd el a mai adagot", target: 1, xp: 15, metric: "reading_done" },
  { key: "game_played", label: () => "Játssz a napi játékkal", target: 1, xp: 15, metric: "game_played" },
  { key: "accuracy_80", label: (t) => `80% pontosság legalább ${t} kártyán`, target: 10, xp: 25, metric: "accuracy_80" },
  { key: "blitz_perfect", label: () => "Villámkör hibátlanul", target: 1, xp: 25, metric: "blitz_perfect" },
];

/** 3 consecutive offsets mod a 7-entry catalog are always distinct — rotates the trio daily. */
export function questsForDay(dayIdx: number): QuestDef[] {
  const n = QUEST_CATALOG.length;
  return [0, 1, 2].map((i) => QUEST_CATALOG[(dayIdx * 3 + i) % n]);
}
