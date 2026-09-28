export const GAMES = [
  { slug: "locate", name: "Hol vagyok?", desc: "Vers → könyv és fejezet" },
  { slug: "timeline", name: "Idővonal", desc: "Események időrendbe" },
  { slug: "numbers", name: "Számháború", desc: "Az emlékezetes számok, 60 mp" },
  { slug: "chain", name: "Genealógia-lánc", desc: "Ki kinek volt az apja?" },
  { slug: "who-said", name: "Ki mondta?", desc: "Mondások, ígéretek, parancsok" },
  { slug: "map", name: "Térkép", desc: "Koppints a helyes pontra" },
  { slug: "boss", name: "Boss fight", desc: "Egy könyv összes kérdése, időre" },
] as const;

export function gameLabel(slug: string): string {
  return GAMES.find((g) => g.slug === slug)?.name ?? slug;
}
