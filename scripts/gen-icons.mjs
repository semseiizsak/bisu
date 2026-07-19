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
function glyphMarkup({ size, bg, fg, inset = 0.17 }) {
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

  return `<rect x="${bookX}" y="${bookY}" width="${bookW}" height="${bookH}" rx="${corner}" fill="${fg}"/>
    <polygon points="${ribbon}" fill="${bg}"/>`;
}

function bookMarkSvg({ size, bg, fg, inset = 0.17 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${bg}"/>
    ${glyphMarkup({ size, bg, fg, inset })}
  </svg>`;
}

/** Full-screen iOS launch image: solid paper background, glyph centered a
 * touch above the middle — visually identical to the in-app SplashScreen so
 * launch image → animated splash → app reads as one continuous surface. */
function startupSvg({ w, h, bg, fg }) {
  const g = Math.round(Math.min(w, h) * 0.3);
  const gx = Math.round((w - g) / 2);
  const gy = Math.round(h * 0.44 - g / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${bg}"/>
    <g transform="translate(${gx},${gy})">${glyphMarkup({ size: g, bg, fg, inset: 0.05 })}</g>
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

// iOS standalone launch images (apple-touch-startup-image). Without these
// iOS shows a plain white/black screen until the server's first byte — the
// exact "long blank splash" complaint. Sizes must match device dimensions
// exactly or iOS ignores them; keep this list in sync with STARTUP_DEVICES
// in src/app/layout.tsx.
const SPLASH_OUT = "public/splash";
const darkPaper = "#14130f";
const darkInk = "#f3f1ea";
await mkdir(SPLASH_OUT, { recursive: true });
const STARTUP_DEVICES = [
  { w: 440, h: 956, dpr: 3 }, // iPhone 16 Pro Max
  { w: 430, h: 932, dpr: 3 }, // 14/15 Pro Max, 16 Plus
  { w: 428, h: 926, dpr: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 414, h: 896, dpr: 3 }, // XS Max, 11 Pro Max
  { w: 414, h: 896, dpr: 2 }, // XR, 11
  { w: 402, h: 874, dpr: 3 }, // 16 Pro
  { w: 393, h: 852, dpr: 3 }, // 14 Pro, 15, 16
  { w: 390, h: 844, dpr: 3 }, // 12, 13, 14
  { w: 375, h: 812, dpr: 3 }, // X, XS, 11 Pro, 12/13 mini
];
for (const { w, h, dpr } of STARTUP_DEVICES) {
  const pw = w * dpr;
  const ph = h * dpr;
  for (const [scheme, bg, fg] of [
    ["light", paper, ink],
    ["dark", darkPaper, darkInk],
  ]) {
    const svg = startupSvg({ w: pw, h: ph, bg, fg });
    const path = `${SPLASH_OUT}/${w}x${h}@${dpr}x-${scheme}.png`;
    await sharp(Buffer.from(svg)).png().toFile(path);
    console.log("wrote", path);
  }
}

console.log("done");
