import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/features/groups/location/actions", () => ({
  savePrimaryLocation: vi.fn(),
}));
import { locationDemoAvailable } from "@/features/groups/location/preview";
import { LocationDemo } from "@/features/groups/location/demo";
describe("isolated location demo", () => {
  it.each([
    [
      {
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "feat/stage0042-operational",
      },
      true,
    ],
    [
      {
        VERCEL_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "feat/stage0042-operational",
      },
      false,
    ],
    [{ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "develop" }, false],
    [{ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main" }, false],
    [{ VERCEL_GIT_COMMIT_REF: "feat/stage0042-operational" }, false],
    [{}, false],
  ] as const)(
    "requires exact Preview and authorized branch",
    (env, expected) => {
      expect(locationDemoAvailable(env)).toBe(expected);
    },
  );
  it("clearly states no persistence, disables provider and contains no real persistence submit", () => {
    const html = renderToStaticMarkup(createElement(LocationDemo));
    expect(html).toContain("Demonstração isolada — sem gravação no banco");
    expect(html).toContain("Validar rascunho — não grava");
    expect(html).toContain("Geoapify desativado");
    expect(html).toContain("apenas nesta aba");
    expect(html).not.toContain("Salvar local principal");
    expect(html).not.toContain('name="timezone"');
    expect(html).not.toContain("<iframe");
    expect(html).toContain('role="combobox"');
  });
});
