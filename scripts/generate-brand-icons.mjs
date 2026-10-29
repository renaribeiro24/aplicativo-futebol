// Existing Next.js dependency; no new application package. SVG is the source.
import sharp from "sharp";
import { readFileSync } from "node:fs";
const root = new URL("../public/icons/", import.meta.url);
const svg = readFileSync(new URL("icon.svg", root));
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(new URL(name, root).pathname);
}
await sharp(Buffer.from(svg.toString().replace('rx="104"', 'rx="0"')))
  .png()
  .toFile(new URL("maskable-512.png", root).pathname);
console.log("BoraFute: PNG icons regenerated from the vector B + ball.");
