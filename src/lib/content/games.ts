export const GAMES = [
  { slug: "locate", name: "Hol vagyok?", desc: "Vers → könyv és fejezet", emoji: "🔍", tone: "sky" },
  { slug: "timeline", name: "Idővonal", desc: "Események időrendbe", emoji: "⏳", tone: "gold" },
  { slug: "numbers", name: "Számháború", desc: "Az emlékezetes számok, 60 mp", emoji: "🔢", tone: "accent" },
  { slug: "chain", name: "Genealógia-lánc", desc: "Ki kinek volt az apja?", emoji: "🌳", tone: "good" },
  { slug: "who-said", name: "Ki mondta?", desc: "Mondások, ígéretek, parancsok", emoji: "💬", tone: "violet" },
  { slug: "map", name: "Térkép", desc: "Koppints a helyes pontra", emoji: "🗺️", tone: "sky" },
  { slug: "boss", name: "Boss fight", desc: "Egy könyv összes kérdése, időre", emoji: "👑", tone: "accent" },
] as const;

export type GameTone = (typeof GAMES)[number]["tone"];

export function gameLabel(slug: string): string {
  return GAMES.find((g) => g.slug === slug)?.name ?? slug;
}

export function gameEmoji(slug: string): string {
  return GAMES.find((g) => g.slug === slug)?.emoji ?? "🎮";
}
