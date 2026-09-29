import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type DB = SupabaseClient<Database>;

export const GAME_ROTATION = ["locate", "timeline", "numbers", "chain", "who-said", "map", "boss"] as const;
export type GameSlug = (typeof GAME_ROTATION)[number];

/** Which games currently have enough content to be playable. One cheap
 * count per game, all in parallel. */
export async function availableGames(db: DB): Promise<Set<GameSlug>> {
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [locate, events, numbers, edges, questions, places] = await Promise.all([
    count(db.from("verses").select("id", { count: "exact", head: true }).eq("verse", 1).limit(1)),
    count(db.from("timeline_events").select("id", { count: "exact", head: true })),
    count(db.from("cards").select("id", { count: "exact", head: true }).eq("type", "question").eq("kind", "number").eq("active", true)),
    count(db.from("genealogy_edges").select("id", { count: "exact", head: true })),
    count(db.from("cards").select("id", { count: "exact", head: true }).eq("type", "question").eq("active", true)),
    count(db.from("geo_places").select("id", { count: "exact", head: true })),
  ]);
  const available = new Set<GameSlug>();
  if (locate > 0) available.add("locate");
  if (events >= 3) available.add("timeline");
  if (numbers >= 5) available.add("numbers");
  if (edges >= 3) available.add("chain");
  if (questions >= 5) available.add("who-said");
  if (places >= 1) available.add("map");
  if (questions >= 10) available.add("boss");
  return available;
}

/** The day's game: rotate by day index, but never land on an empty game. */
export function pickGame(dayIdx: number, available: Set<GameSlug>): GameSlug | null {
  if (available.size === 0) return null;
  for (let i = 0; i < GAME_ROTATION.length; i++) {
    const g = GAME_ROTATION[(dayIdx - 1 + i) % GAME_ROTATION.length];
    if (available.has(g)) return g;
  }
  return null;
}
