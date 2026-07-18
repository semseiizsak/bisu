import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";

const PUBLIC_OUT = "public/icons";
const APP_DIR = "src/app";
await mkdir(PUBLIC_OUT, { recursive: true });

const ink = "#16140f";
const paper = "#fbfaf8";
const accent = "#a13d2d";

/**
 * Minimal "book with a bookmark ribbon" glyph: a single rounded-rect book
 * in the fill color, with a ribbon shape cut out of it in the background
 * color. Flat, two-tone, no gradients or fine detail — reads clearly at
 * favicon size and unambiguously as a book.
 */
function bookMarkSvg({ size, bg, fg, inset = 0.17 }) {
  const s = size;
  const bookX = s * inset;
  const bookY = s * (inset - 0.02);
  const bookW = s - bookX * 2;
  const bookH = s - bookY * 2;
  const corner = s * 0.07;

  const ribbonX1 = bookX + bookW * 0.2;
  const ribbonX2 = ribbonX1 + bookW * 0.17;
  const ribbonMidX = (ribbonX1 + ribbonX2) / 2;
  const ribbonTopY = bookY;
  const ribbonBottomY = bookY + bookH * 0.46;
  const ribbonNotchY = ribbonBottomY - bookH * 0.1;

  const ribbon = [
    [ribbonX1, ribbonTopY],
    [ribbonX2, ribbonTopY],
    [ribbonX2, ribbonBottomY],
    [ribbonMidX, ribbonNotchY],
    [ribbonX1, ribbonBottomY],
  ]
    .map((p) => p.join(","))
    .join(" ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" fill="${bg}"/>
    <rect x="${bookX}" y="${bookY}" width="${bookW}" height="${bookH}" rx="${corner}" fill="${fg}"/>
    <polygon points="${ribbon}" fill="${bg}"/>
  </svg>`;
}

async function make(path, size, opts) {
  const svg = bookMarkSvg({ size, ...opts });
  await sharp(Buffer.from(svg)).png().toFile(path);
  console.log("wrote", path);
}

// PWA manifest icons (Android "Add to Home Screen" / standalone install)
await make(`${PUBLIC_OUT}/icon-192.png`, 192, { bg: paper, fg: ink, inset: 0.17 });
await make(`${PUBLIC_OUT}/icon-512.png`, 512, { bg: paper, fg: ink, inset: 0.17 });
// Maskable needs extra safe-zone padding so Android's shape mask doesn't clip content
await make(`${PUBLIC_OUT}/icon-maskable-512.png`, 512, { bg: accent, fg: paper, inset: 0.29 });

// Next.js file-convention icons: auto-wires <link rel="icon"> / rel="apple-touch-icon">
await make(`${APP_DIR}/icon.png`, 512, { bg: paper, fg: ink, inset: 0.17 });
await make(`${APP_DIR}/apple-icon.png`, 180, { bg: paper, fg: ink, inset: 0.19 });

await rm(`${APP_DIR}/favicon.ico`, { force: true });
console.log("removed stale favicon.ico (superseded by icon.png)");

console.log("done");
