import { Inter, Literata } from "next/font/google";

export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "800"],
  display: "swap",
});

export const reading = Literata({
  variable: "--font-reading",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});
