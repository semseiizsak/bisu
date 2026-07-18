import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const GAMES = [
  { slug: "locate", name: "Hol vagyok?", desc: "Vers → könyv és fejezet" },
  { slug: "timeline", name: "Idővonal", desc: "Események időrendbe" },
  { slug: "numbers", name: "Számháború", desc: "Gyors számkvíz, 60 mp" },
  { slug: "chain", name: "Genealógia-lánc", desc: "Ki kinek volt az apja?" },
  { slug: "who-said", name: "Ki mondta?", desc: "Kvíz-kihívás" },
  { slug: "map", name: "Térkép", desc: "Koppints a helyes pontra" },
  { slug: "build", name: "Építsd fel", desc: "Méretek kitöltése" },
  { slug: "boss", name: "Boss fight", desc: "40 kérdés, egy könyv, időre" },
] as const;

export default function GamesPage() {
  return (
    <main className="mx-auto max-w-md px-4 pt-8">
      <h1 className="text-2xl font-extrabold text-ink">Játékok</h1>
      <p className="mt-1 text-sm text-ink-muted">A mai ajánlott játékot a Ma fül jelöli — de bármelyik elérhető.</p>

      <div className="mt-6 grid grid-cols-1 gap-3">
        {GAMES.map((g) => (
          <Card key={g.slug} className="p-4">
            <p className="font-extrabold text-ink">{g.name}</p>
            <p className="text-sm text-ink-muted">{g.desc}</p>
            <ButtonLink href={`/jatekok/${g.slug}`} size="sm" variant="secondary" className="mt-3">
              Játék indítása
            </ButtonLink>
          </Card>
        ))}
      </div>
    </main>
  );
}
