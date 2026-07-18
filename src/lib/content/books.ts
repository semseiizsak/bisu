export type Genre =
  | "law"
  | "history"
  | "wisdom"
  | "prophecy"
  | "gospel"
  | "epistle"
  | "apocalyptic";

export interface BookDef {
  slug: string;
  name_hu: string;
  short_hu: string;
  testament: "OT" | "NT";
  order_idx: number;
  genre: Genre;
}

// Order matches the canonical 66-book Protestant order, identical to the
// order of the getbible.net "karoli" (Revideált Károli Biblia 1908) dataset.
export const BOOKS: BookDef[] = [
  { slug: "genesis", name_hu: "Mózes első könyve", short_hu: "1Móz", testament: "OT", order_idx: 1, genre: "law" },
  { slug: "exodus", name_hu: "Mózes második könyve", short_hu: "2Móz", testament: "OT", order_idx: 2, genre: "law" },
  { slug: "leviticus", name_hu: "Mózes harmadik könyve", short_hu: "3Móz", testament: "OT", order_idx: 3, genre: "law" },
  { slug: "numbers", name_hu: "Mózes negyedik könyve", short_hu: "4Móz", testament: "OT", order_idx: 4, genre: "law" },
  { slug: "deuteronomy", name_hu: "Mózes ötödik könyve", short_hu: "5Móz", testament: "OT", order_idx: 5, genre: "law" },
  { slug: "joshua", name_hu: "Józsué könyve", short_hu: "Józs", testament: "OT", order_idx: 6, genre: "history" },
  { slug: "judges", name_hu: "Bírák könyve", short_hu: "Bír", testament: "OT", order_idx: 7, genre: "history" },
  { slug: "ruth", name_hu: "Ruth könyve", short_hu: "Ruth", testament: "OT", order_idx: 8, genre: "history" },
  { slug: "1samuel", name_hu: "Sámuel első könyve", short_hu: "1Sám", testament: "OT", order_idx: 9, genre: "history" },
  { slug: "2samuel", name_hu: "Sámuel második könyve", short_hu: "2Sám", testament: "OT", order_idx: 10, genre: "history" },
  { slug: "1kings", name_hu: "Királyok első könyve", short_hu: "1Kir", testament: "OT", order_idx: 11, genre: "history" },
  { slug: "2kings", name_hu: "Királyok második könyve", short_hu: "2Kir", testament: "OT", order_idx: 12, genre: "history" },
  { slug: "1chronicles", name_hu: "Krónikák első könyve", short_hu: "1Krón", testament: "OT", order_idx: 13, genre: "history" },
  { slug: "2chronicles", name_hu: "Krónikák második könyve", short_hu: "2Krón", testament: "OT", order_idx: 14, genre: "history" },
  { slug: "ezra", name_hu: "Ezsdrás könyve", short_hu: "Ezsdr", testament: "OT", order_idx: 15, genre: "history" },
  { slug: "nehemiah", name_hu: "Nehémiás könyve", short_hu: "Neh", testament: "OT", order_idx: 16, genre: "history" },
  { slug: "esther", name_hu: "Eszter könyve", short_hu: "Eszt", testament: "OT", order_idx: 17, genre: "history" },
  { slug: "job", name_hu: "Jób könyve", short_hu: "Jób", testament: "OT", order_idx: 18, genre: "wisdom" },
  { slug: "psalms", name_hu: "Zsoltárok könyve", short_hu: "Zsolt", testament: "OT", order_idx: 19, genre: "wisdom" },
  { slug: "proverbs", name_hu: "Példabeszédek könyve", short_hu: "Péld", testament: "OT", order_idx: 20, genre: "wisdom" },
  { slug: "ecclesiastes", name_hu: "Prédikátor könyve", short_hu: "Préd", testament: "OT", order_idx: 21, genre: "wisdom" },
  { slug: "songofsongs", name_hu: "Énekek éneke", short_hu: "Én", testament: "OT", order_idx: 22, genre: "wisdom" },
  { slug: "isaiah", name_hu: "Ésaiás könyve", short_hu: "Ésa", testament: "OT", order_idx: 23, genre: "prophecy" },
  { slug: "jeremiah", name_hu: "Jeremiás könyve", short_hu: "Jer", testament: "OT", order_idx: 24, genre: "prophecy" },
  { slug: "lamentations", name_hu: "Jeremiás siralmai", short_hu: "Sir", testament: "OT", order_idx: 25, genre: "prophecy" },
  { slug: "ezekiel", name_hu: "Ezékiel könyve", short_hu: "Ez", testament: "OT", order_idx: 26, genre: "prophecy" },
  { slug: "daniel", name_hu: "Dániel könyve", short_hu: "Dán", testament: "OT", order_idx: 27, genre: "apocalyptic" },
  { slug: "hosea", name_hu: "Hóseás könyve", short_hu: "Hós", testament: "OT", order_idx: 28, genre: "prophecy" },
  { slug: "joel", name_hu: "Jóel könyve", short_hu: "Jóel", testament: "OT", order_idx: 29, genre: "prophecy" },
  { slug: "amos", name_hu: "Ámós könyve", short_hu: "Ámós", testament: "OT", order_idx: 30, genre: "prophecy" },
  { slug: "obadiah", name_hu: "Abdiás könyve", short_hu: "Abd", testament: "OT", order_idx: 31, genre: "prophecy" },
  { slug: "jonah", name_hu: "Jónás könyve", short_hu: "Jón", testament: "OT", order_idx: 32, genre: "prophecy" },
  { slug: "micah", name_hu: "Mikeás könyve", short_hu: "Mik", testament: "OT", order_idx: 33, genre: "prophecy" },
  { slug: "nahum", name_hu: "Náhum könyve", short_hu: "Náh", testament: "OT", order_idx: 34, genre: "prophecy" },
  { slug: "habakkuk", name_hu: "Habakuk könyve", short_hu: "Hab", testament: "OT", order_idx: 35, genre: "prophecy" },
  { slug: "zephaniah", name_hu: "Sofóniás könyve", short_hu: "Sof", testament: "OT", order_idx: 36, genre: "prophecy" },
  { slug: "haggai", name_hu: "Aggeus könyve", short_hu: "Agg", testament: "OT", order_idx: 37, genre: "prophecy" },
  { slug: "zechariah", name_hu: "Zakariás könyve", short_hu: "Zak", testament: "OT", order_idx: 38, genre: "prophecy" },
  { slug: "malachi", name_hu: "Malakiás könyve", short_hu: "Mal", testament: "OT", order_idx: 39, genre: "prophecy" },
  { slug: "matthew", name_hu: "Máté evangyélioma", short_hu: "Mát", testament: "NT", order_idx: 40, genre: "gospel" },
  { slug: "mark", name_hu: "Márk evangyélioma", short_hu: "Márk", testament: "NT", order_idx: 41, genre: "gospel" },
  { slug: "luke", name_hu: "Lukács evangyélioma", short_hu: "Luk", testament: "NT", order_idx: 42, genre: "gospel" },
  { slug: "john", name_hu: "János evangyélioma", short_hu: "Ján", testament: "NT", order_idx: 43, genre: "gospel" },
  { slug: "acts", name_hu: "Apostolok cselekedetei", short_hu: "Csel", testament: "NT", order_idx: 44, genre: "history" },
  { slug: "romans", name_hu: "Pál levele a rómaiakhoz", short_hu: "Róm", testament: "NT", order_idx: 45, genre: "epistle" },
  { slug: "1corinthians", name_hu: "Pál első levele a korinthusbeliekhez", short_hu: "1Kor", testament: "NT", order_idx: 46, genre: "epistle" },
  { slug: "2corinthians", name_hu: "Pál második levele a korinthusbeliekhez", short_hu: "2Kor", testament: "NT", order_idx: 47, genre: "epistle" },
  { slug: "galatians", name_hu: "Pál levele a galátziabeliekhez", short_hu: "Gal", testament: "NT", order_idx: 48, genre: "epistle" },
  { slug: "ephesians", name_hu: "Pál levele az efézusbeliekhez", short_hu: "Eféz", testament: "NT", order_idx: 49, genre: "epistle" },
  { slug: "philippians", name_hu: "Pál levele a filippibeliekhez", short_hu: "Fil", testament: "NT", order_idx: 50, genre: "epistle" },
  { slug: "colossians", name_hu: "Pál levele a kolosébeliekhez", short_hu: "Kol", testament: "NT", order_idx: 51, genre: "epistle" },
  { slug: "1thessalonians", name_hu: "Pál első levele a thessalonikabeliekhez", short_hu: "1Thess", testament: "NT", order_idx: 52, genre: "epistle" },
  { slug: "2thessalonians", name_hu: "Pál második levele a thessalonikabeliekhez", short_hu: "2Thess", testament: "NT", order_idx: 53, genre: "epistle" },
  { slug: "1timothy", name_hu: "Pál első levele Timótheushoz", short_hu: "1Tim", testament: "NT", order_idx: 54, genre: "epistle" },
  { slug: "2timothy", name_hu: "Pál második levele Timótheushoz", short_hu: "2Tim", testament: "NT", order_idx: 55, genre: "epistle" },
  { slug: "titus", name_hu: "Pál levele Titushoz", short_hu: "Tit", testament: "NT", order_idx: 56, genre: "epistle" },
  { slug: "philemon", name_hu: "Pál levele Filemonhoz", short_hu: "Filem", testament: "NT", order_idx: 57, genre: "epistle" },
  { slug: "hebrews", name_hu: "Pál levele a zsidókhoz", short_hu: "Zsid", testament: "NT", order_idx: 58, genre: "epistle" },
  { slug: "james", name_hu: "Jakab levele", short_hu: "Jak", testament: "NT", order_idx: 59, genre: "epistle" },
  { slug: "1peter", name_hu: "Péter első levele", short_hu: "1Pét", testament: "NT", order_idx: 60, genre: "epistle" },
  { slug: "2peter", name_hu: "Péter második levele", short_hu: "2Pét", testament: "NT", order_idx: 61, genre: "epistle" },
  { slug: "1john", name_hu: "János első levele", short_hu: "1Ján", testament: "NT", order_idx: 62, genre: "epistle" },
  { slug: "2john", name_hu: "János második levele", short_hu: "2Ján", testament: "NT", order_idx: 63, genre: "epistle" },
  { slug: "3john", name_hu: "János harmadik levele", short_hu: "3Ján", testament: "NT", order_idx: 64, genre: "epistle" },
  { slug: "jude", name_hu: "Júdás levele", short_hu: "Júd", testament: "NT", order_idx: 65, genre: "epistle" },
  { slug: "revelation", name_hu: "Jelenések könyve", short_hu: "Jel", testament: "NT", order_idx: 66, genre: "apocalyptic" },
];
