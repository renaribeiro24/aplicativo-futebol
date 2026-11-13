import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";
const m = vi.hoisted(() => ({
  load: vi.fn(),
  rows: vi.fn(),
  head: vi.fn(),
  panel: vi.fn(() => null),
  filters: vi.fn(),
  select: vi.fn(),
  tables: vi.fn(),
}));
vi.mock("@/features/groups/server", () => ({ loadManagedGroup: m.load }));
vi.mock("@/features/groups/actions", () => ({ updateGroupDetails: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/components/forms/action-form", () => ({
  ActionForm: ({ children }: { children: ReactNode }) =>
    createElement("form", null, children),
}));
vi.mock("@/features/groups/operations/panel", () => ({
  OperationsPanel: m.panel,
  SettingsPager: () => null,
}));
vi.mock("@/features/groups/operations/forms", () => ({
  VenueForm: () => null,
}));
import Settings from "@/app/(protected)/groups/[slug]/settings/page";
import Section from "@/app/(protected)/groups/[slug]/settings/[section]/page";
import { ParticipationPreparation } from "@/features/groups/operations/participation";
const section = (name: string) =>
  Section({ params: Promise.resolve({ slug: "alpha", section: name }) });
describe("settings hub and subpages — synthetic local fixtures only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.head.mockResolvedValue({ data: null, error: null, count: 2 });
    m.rows.mockResolvedValue({ data: [], error: null, count: 0 });
    const from = (table: string) => {
      m.tables(table);
      const chain = {
        select: m.select,
        eq: m.filters,
        is: vi.fn(),
        order: vi.fn(),
        limit: m.rows,
        range: m.rows,
        then: (
          resolve: (value: unknown) => unknown,
          reject: (reason: unknown) => unknown,
        ) => m.head().then(resolve, reject),
      };
      for (const fn of [chain.select, chain.eq, chain.is, chain.order])
        fn.mockReturnValue(chain);
      return chain;
    };
    m.load.mockResolvedValue({
      db: { from },
      role: "owner",
      group: {
        id: "fixture-a",
        name: "Turma sintética",
        description: "",
        timezone: "America/Sao_Paulo",
      },
    });
  });
  it("renders five distinct cards, real counts and responsive grid without forms", async () => {
    const html = renderToStaticMarkup(
      await Settings({ params: Promise.resolve({ slug: "alpha" }) }),
    );
    for (const path of ["general", "members", "venues", "schedule", "finance"])
      expect(html).toContain(`/groups/alpha/settings/${path}`);
    expect(html.match(/<h2/g) ?? []).toHaveLength(5);
    expect(html).toContain("md:grid-cols-2 lg:grid-cols-3");
    expect(html).toContain("2 integrante(s) ativo(s)");
    expect(html).not.toContain("<form");
    expect(m.select.mock.calls.every((c) => c[1].head === true)).toBe(true);
    expect(m.filters).toHaveBeenCalledWith("group_id", "fixture-a");
  });
  it("never shows a failed counter as zero or leaks upstream errors", async () => {
    m.head.mockResolvedValue({
      data: null,
      count: null,
      error: { message: "private detail" },
    });
    const html = renderToStaticMarkup(
      await Settings({ params: Promise.resolve({ slug: "alpha" }) }),
    );
    expect(html).toContain("Indicador indisponível");
    expect(html).not.toContain("private detail");
  });
  it("keeps general data fields on their own page without unrelated queries", async () => {
    const html = renderToStaticMarkup(await section("general"));
    for (const field of ["name", "description", "timezone"])
      expect(html).toContain(`name="${field}"`);
    expect(html).toContain("Voltar à administração");
    expect(m.tables).not.toHaveBeenCalled();
  });
  it.each(["members", "venues", "schedule", "finance"])(
    "renders the %s subpage with a return link",
    async (name) => {
      const html = renderToStaticMarkup(await section(name));
      expect(html).toContain('href="/groups/alpha/settings"');
      expect(m.load).toHaveBeenCalledWith("alpha");
      if (name === "members") expect(html).toContain("Funções no grupo");
      if (name === "schedule" || name === "finance" || name === "members")
        expect(m.panel).toHaveBeenCalledWith(
          expect.objectContaining({
            section:
              name === "schedule"
                ? "schedule"
                : name === "finance"
                  ? "pricing"
                  : "billing",
          }),
          undefined,
        );
    },
  );
  it("identifies the administrative role explicitly", async () => {
    m.rows.mockResolvedValue({
      data: [
        {
          id: "member",
          role: "guest",
          player_id: "synthetic",
          players: { name: "Convidado sintético", nickname: null },
        },
      ],
      error: null,
      count: 1,
    });
    const html = renderToStaticMarkup(await section("members"));
    expect(html).toContain("Função: ");
    expect(html).toContain("guest");
    expect(html).not.toContain('name="role"');
  });
  it("rejects an unknown area before querying", async () => {
    await expect(section("other")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(m.tables).not.toHaveBeenCalled();
  });
  it.each(["general", "members", "venues", "schedule", "finance"])(
    "preserves the manager guard for %s",
    async (name) => {
      m.load.mockRejectedValue(Error("NEXT_NOT_FOUND"));
      await expect(section(name)).rejects.toThrow("NEXT_NOT_FOUND");
      expect(m.tables).not.toHaveBeenCalled();
    },
  );
  it("propagates section load errors without upstream details", async () => {
    m.rows.mockResolvedValue({
      data: null,
      error: { message: "private detail" },
    });
    await expect(section("members")).rejects.toThrow(
      "Não foi possível carregar a administração",
    );
  });
  it("retains the disabled participation component without an invented persistence contract", () => {
    const html = renderToStaticMarkup(createElement(ParticipationPreparation));
    expect(html).not.toContain("<form");
    expect(html).toContain("Nenhuma alteração pode ser salva");
  });
});
