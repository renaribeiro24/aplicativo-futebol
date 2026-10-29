import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";
const m = vi.hoisted(() => ({ load: vi.fn(), limit: vi.fn() }));
vi.mock("@/features/groups/server", () => ({ loadManagedGroup: m.load }));
vi.mock("@/features/groups/actions", () => ({ updateGroupDetails: vi.fn() }));
vi.mock("@/components/forms/action-form", () => ({
  ActionForm: ({ children }: { children: ReactNode }) =>
    createElement("form", null, children),
}));
import Settings from "@/app/(protected)/groups/[slug]/settings/page";
import { PendingConfiguration } from "@/features/groups/pending-configuration";
describe("settings render — synthetic local fixtures only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
      limit: m.limit,
    };
    for (const fn of [chain.select, chain.eq, chain.is, chain.order])
      fn.mockReturnValue(chain);
    m.limit.mockResolvedValue({ data: [], error: null });
    m.load.mockResolvedValue({
      db: { from: () => chain },
      role: "owner",
      group: {
        id: "fixture-a",
        name: "Turma sintética",
        description: "",
        timezone: "America/Sao_Paulo",
      },
    });
  });
  it("renders honest empty states and the working details fields", async () => {
    const html = renderToStaticMarkup(
      await Settings({ params: Promise.resolve({ slug: "alpha" }) }),
    );
    expect(html).toContain("Nenhum integrante ativo");
    expect(html).toContain("Nenhum local cadastrado");
    expect(html).toContain('name="name"');
    expect(html).toContain('name="description"');
    expect(html).toContain('name="timezone"');
    expect(html).not.toContain("salvos com sucesso");
  });
  it("propagates loading errors without private upstream detail", async () => {
    m.limit.mockResolvedValue({
      data: null,
      error: { message: "private detail" },
    });
    await expect(
      Settings({ params: Promise.resolve({ slug: "alpha" }) }),
    ).rejects.toThrow("Não foi possível carregar a administração");
  });
  it.each([true, false])(
    "disables every future section without a submit action (owner=%s)",
    (owner) => {
      const html = renderToStaticMarkup(
        createElement(PendingConfiguration, { owner }),
      );
      expect((html.match(/<fieldset disabled=""/g) ?? []).length).toBe(4);
      expect(html).not.toContain("<form");
      expect(html).not.toContain('type="submit"');
      expect(html).not.toContain('value="80"');
      expect(html).not.toContain('value="25"');
      expect(html).toContain("Nenhuma alteração pode ser salva");
    },
  );
});
