import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../src/app/manifest";
import { brand } from "../src/lib/brand";

const css = readFileSync(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);
function tokens(section: string) {
  return Object.fromEntries(
    [...section.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
}
const light = tokens(css.slice(css.indexOf(":root {"), css.indexOf("@media")));
const dark = {
  ...light,
  ...tokens(css.slice(css.indexOf("@media"), css.indexOf("@theme"))),
};
function color(palette: Record<string, string>, name: string): string {
  const value = palette[name];
  if (value?.startsWith("var(")) return color(palette, value.slice(6, -1));
  if (!/^#[a-f\d]{6}$/i.test(value ?? ""))
    throw new Error(`Non-sRGB color: ${name}`);
  return value;
}
function luminance(hex: string) {
  const channels = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const [r, g, b] = channels.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const textPairs = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["primary", "background"],
  ["primary", "card"],
  ["primary-foreground", "primary"],
  ["brand-foreground", "brand"],
  ["brand-foreground", "brand-hover"],
  ["brand-foreground", "brand-active"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive", "card"],
  ["destructive", "destructive-surface"],
  ["destructive-foreground", "destructive"],
  ["success", "success-surface"],
  ["warning", "warning-surface"],
  ["info", "info-surface"],
  ["pitch-foreground", "pitch"],
  ["brand", "pitch"],
];
for (const [theme, palette] of [
  ["light", light],
  ["dark", dark],
] as const) {
  describe(`BoraFute WCAG contrast: ${theme}`, () => {
    it.each(textPairs)("normal text %s / %s is at least 4.5:1", (fg, bg) => {
      expect(
        contrast(color(palette, fg), color(palette, bg)),
      ).toBeGreaterThanOrEqual(4.5);
    });
    it.each([
      ["input", "card"],
      ["input", "background"],
      ["ring", "card"],
      ["ring", "background"],
    ])("essential boundary/focus %s / %s is at least 3:1", (fg, bg) => {
      expect(
        contrast(color(palette, fg), color(palette, bg)),
      ).toBeGreaterThanOrEqual(3);
    });
  });
}
it("keeps product identity and PWA metadata consistent with the theme", () => {
  const m = manifest();
  expect(m.short_name).toBe(brand.name);
  expect(m.description).toBe(brand.statement);
  expect(m.name).toContain(brand.slogan);
  expect(m.background_color).toBe(color(light, "background"));
  expect(m.theme_color).toBe(color(dark, "background"));
});
