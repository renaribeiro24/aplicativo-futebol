import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { Brand } from "../src/components/layout/brand";
import { brand } from "../src/lib/brand";

const variations = [
  "horizontal-dark",
  "horizontal-light",
  "horizontal-white",
  "horizontal-graphite",
  "main-dark",
  "main-light",
  "main-white",
  "main-graphite",
  "symbol",
];
describe("official vector brand assets", () => {
  it.each(variations)(
    "%s is self-contained vector art, not the reference screenshot",
    (variant) => {
      const svg = readFileSync(
        new URL(`../public/brand/borafute-${variant}.svg`, import.meta.url),
        "utf8",
      );
      expect(svg).toContain("<svg");
      expect(svg).toContain("<path");
      expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
      expect(svg).not.toMatch(
        /<image|<text|<script|@font-face|data:image|href=/i,
      );
    },
  );
  it.each([
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["maskable-512.png", 512],
    ["apple-touch-icon.png", 180],
  ] as const)(
    "%s is a real PNG at its declared PWA dimensions",
    async (name, size) => {
      const path = new URL(`../public/icons/${name}`, import.meta.url);
      const bytes = readFileSync(path);
      const metadata = await sharp(bytes).metadata();
      expect(metadata.format).toBe("png");
      expect([metadata.width, metadata.height]).toEqual([size, size]);
      const stats = await sharp(bytes).resize(16, 16).stats();
      expect(stats.channels.some((channel) => channel.stdev > 10)).toBe(true);
    },
  );
  it("uses a theme-aware horizontal logo and one accessible link name", () => {
    const html = renderToStaticMarkup(createElement(Brand));
    expect(html).toContain(`aria-label="${brand.name}, início"`);
    expect(html).toContain('media="(prefers-color-scheme: dark)"');
    expect(html).toContain("borafute-horizontal-dark.svg");
    expect(html).toContain("borafute-horizontal-light.svg");
    expect(html).toContain('alt=""');
  });
  it("provides accessible product and slogan for the standalone principal lockup", () => {
    const html = renderToStaticMarkup(
      createElement(Brand, { variant: "main", tone: "dark", linked: false }),
    );
    expect(html).toContain(`alt="${brand.name}"`);
    expect(html).toContain(brand.slogan);
    expect(html).toContain("borafute-horizontal-dark.svg");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<source");
  });
});

it("keeps the maskable icon opaque and its mark inside the central safe circle", async () => {
  const { data, info } = await sharp(
    readFileSync(new URL("../public/icons/maskable-512.png", import.meta.url)),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let outside = 0;
  let nonOpaque = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (data[i + 3] !== 255) nonOpaque++;
      const ink =
        Math.max(
          Math.abs(data[i] - 32),
          Math.abs(data[i + 1] - 37),
          Math.abs(data[i + 2] - 43),
        ) > 15;
      if (
        ink &&
        Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2) >
          info.width * 0.4
      )
        outside++;
    }
  expect(outside).toBe(0);
  expect(nonOpaque).toBe(0);
});
