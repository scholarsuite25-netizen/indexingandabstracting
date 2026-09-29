import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const OUT = new URL("../public/icons/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const GLYPHS = {
  book: `
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
  dashboard: `
    <path d="M12 2 2 7l10 5 10-5-10-5z"/>
    <path d="M2 17l10 5 10-5"/>
    <path d="M2 12l10 5 10-5"/>`,
  assessments: `
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`,
};

function svg(glyph, size) {
  const pad = size * 0.24;
  const stroke = Math.max(2, size * 0.055);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="#0B3A82"/>
  <g transform="translate(${pad} ${pad}) scale(${(size - pad * 2) / 24})"
     fill="none" stroke="#ffffff" stroke-width="${(stroke * 24) / (size - pad * 2)}"
     stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
</svg>`;
}

const mainSizes = [72, 96, 128, 144, 152, 192, 384, 512];

await mkdir(OUT, { recursive: true });

for (const size of mainSizes) {
  await sharp(Buffer.from(svg(GLYPHS.book, size))).png().toFile(`${OUT}icon-${size}.png`);
}

for (const [name, glyph] of Object.entries(GLYPHS)) {
  if (name === "book") continue;
  await sharp(Buffer.from(svg(glyph, 192))).png().toFile(`${OUT}${name}.png`);
}
await sharp(Buffer.from(svg(GLYPHS.book, 192))).png().toFile(`${OUT}course.png`);

console.log("icons written to", OUT);
