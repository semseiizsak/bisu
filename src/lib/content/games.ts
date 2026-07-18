export const GAMES = [
  { slug: "locate", name: "Hol vagyok?", desc: "Vers → könyv és fejezet" },
  { slug: "timeline", name: "Idővonal", desc: "Események időrendbe" },
  { slug: "numbers", name: "Számháború", desc: "Gyors számkvíz, 60 mp" },
  { slug: "chain", name: "Genealógia-lánc", desc: "Ki kinek volt az apja?" },
  { slug: "who-said", name: "Ki mondta?", desc: "Kvíz-kihívás" },
  { slug: "map", name: "Térkép", desc: "Koppints a helyes pontra" },
  { slug: "build", name: "Építsd fel", desc: "Méretek kitöltése" },
  { slug: "boss", name: "Boss fight", desc: "40 kérdés, egy könyv, időre" },
] as const;

export function gameLabel(slug: string): string {
  return GAMES.find((g) => g.slug === slug)?.name ?? slug;
}
