/** Section 7.2 — hand-picked focus notes for the densest chapters. */
export const FOCUS_NOTES: { book_slug: string; ch_from: number; ch_to: number; note: string }[] = [
  { book_slug: "exodus", ch_from: 25, ch_to: 27, note: "Szent sátor: minden méret külön kártya. Lassíts." },
  { book_slug: "exodus", ch_from: 28, ch_to: 28, note: "Papi öltözet: 12 kő sorrendje." },
  { book_slug: "leviticus", ch_from: 1, ch_to: 7, note: "Áldozattípusok: mi, miért, hogyan — táblázatként." },
  { book_slug: "numbers", ch_from: 1, ch_to: 2, note: "Törzsek létszáma és táborrendje." },
  { book_slug: "1kings", ch_from: 6, ch_to: 7, note: "Templom méretei — vesd össze a szent sátorral." },
  { book_slug: "ezekiel", ch_from: 40, ch_to: 48, note: "Látomás-templom méretei. A legnehezebb blokk." },
];

export function focusNoteFor(bookSlug: string, chFrom: number, chTo: number): string | null {
  for (const f of FOCUS_NOTES) {
    if (f.book_slug === bookSlug && chFrom <= f.ch_to && chTo >= f.ch_from) return f.note;
  }
  return null;
}
