import { Nunito, Literata } from "next/font/google";

/** Rounded, friendly UI face — the whole app leans on its 800/900 weights. */
export const sans = Nunito({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
});

/** Bible text only. */
export const reading = Literata({
  variable: "--font-reading",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});
