export interface McqPayload {
  options: string[];
}
export interface NumericPayload {
  unit: string | null;
}
export interface ClozePayload {
  full_verse: string;
}
export interface OrderPayload {
  items: { id: number; label: string }[];
  correct_order: number[];
}
export interface LocatePayload {
  verse_text: string;
  book_id: number;
  chapter: number;
}
export interface ChainPayload {
  line: string;
  direction: "parent" | "child";
}
export interface MapPayload {
  svg_x: number;
  svg_y: number;
  tolerance: number;
  place_type: string | null;
}
