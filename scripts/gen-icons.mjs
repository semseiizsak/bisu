import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

const ink = "#16140f";
const paper = "#fbfaf8";
const accent = "#a13d2d";

function markSvg({ size, bg, fg }) {
  const s = size;
  const fontSize = Math.round(s * 0.52);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" fill="${bg}"/>
    <text x="50%" y="52%" text-anchor="middle" dominant-baseline="central"
      font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${fontSize}" fill="${fg}">B</text>
  </svg>`;
}

async function make(name, size, opts) {
  const svg = markSvg({ size, ...opts });
  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${name}`);
  console.log("wrote", name);
}

await make("icon-192.png", 192, { bg: paper, fg: ink });
await make("icon-512.png", 512, { bg: paper, fg: ink });
await make("icon-maskable-512.png", 512, { bg: accent, fg: paper });
await make("apple-touch-icon.png", 180, { bg: paper, fg: ink });

console.log("done");
