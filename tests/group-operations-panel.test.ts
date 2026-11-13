import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/features/groups/operations/actions", () => ({
  saveSchedule: vi.fn(),
  deactivateSchedule: vi.fn(),
  savePricing: vi.fn(),
  saveBilling: vi.fn(),
  endPricing: vi.fn(),
  endBilling: vi.fn(),
  createVenue: vi.fn(),
}));
vi.mock("@/components/forms/action-form", () => ({
  ActionForm: ({ children, label }: { children: ReactNode; label: string }) =>
    createElement(
      "form",
      { className: "space-y-5" },
      children,
      createElement("button", { type: "submit" }, label),
    ),
}));
import {
  SettingsPager,
  OperationsPanel,
} from "@/features/groups/operations/panel";
const group = "00000000-0000-4000-8000-000000000001";
const rows: Record<string, unknown[]> = {};
let failed = false;
const filters: { table: string; value: unknown }[] = [];
const db = {
  from: (table: string) => {
    const q = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() };
    q.select.mockReturnValue(q);
    q.eq.mockImplementation((_key: string, value: unknown) => {
      filters.push({ table, value });
      return q;
    });
    q.order.mockReturnValue(q);
    q.range.mockImplementation(async () => ({
      data: failed ? null : rows[table],
      count: rows[table]?.length,
      error: failed ? { code: "error", message: "private failure" } : null,
    }));
    return q;
  },
} as unknown as SupabaseClient<Database>;
const props = {
  slug: "alpha",
  groupId: group,
  timezone: "UTC",
  db,
  members: [
    {
      player_id: "synthetic-player",
      role: "guest",
      players: { name: "Convidado sintético", nickname: null },
    },
  ],
  venues: [],
  query: {},
};
describe("operational panel rendering (synthetic local data)", () => {
  beforeEach(() => {
    for (const table of [
      "group_schedules",
      "group_pricing_policies",
      "member_billing_terms",
    ])
      rows[table] = [];
    failed = false;
    filters.length = 0;
  });
  it("renders honest empty states and no invented prices", async () => {
    const html = renderToStaticMarkup(
      await OperationsPanel({ ...props, role: "owner" }),
    );
    expect(html).toContain("Nenhuma agenda");
    expect(html).toContain("Nenhuma política");
    expect(html).toContain("Nenhuma classificação");
    expect(html).toContain("Cadastrar política em intervalo livre");
    expect(html).not.toContain('value="80"');
    expect(filters.every((f) => f.value === group)).toBe(true);
  });
  it("lets admin view prices but hides every pricing mutation form", async () => {
    const html = renderToStaticMarkup(
      await OperationsPanel({ ...props, role: "admin" }),
    );
    expect(html).not.toContain("Cadastrar política em intervalo livre");
    expect(html).not.toContain('name="monthly_amount"');
    expect(html).toContain("Cadastrar classificação");
  });
  it.each(["player", "guest"])(
    "rejects %s before querying private configuration",
    async (role) => {
      await expect(OperationsPanel({ ...props, role })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(filters).toEqual([]);
    },
  );
  it("renders ended financial history without edit/close controls", async () => {
    rows.group_pricing_policies = [
      {
        id: "closed-policy",
        effective_from: "2020-01-01",
        effective_until: "2020-02-01",
        monthly_amount_cents: 8001,
        casual_amount_cents: 2000,
        due_day: 10,
      },
    ];
    const html = renderToStaticMarkup(
      await OperationsPanel({ ...props, role: "owner" }),
    );
    const article = html.split("<article")[1].split("</article>")[0];
    expect(article).toContain("Histórico encerrado");
    expect(article).not.toContain("<form");
    expect(article).not.toContain("Editar");
    expect(article).toContain("80,01");
  });
  it("fails closed on load errors rather than inventing empty data", async () => {
    failed = true;
    await expect(OperationsPanel({ ...props, role: "owner" })).rejects.toThrow(
      "Não foi possível carregar as configurações",
    );
  });
  it.each([
    ["schedule", "group_schedules", "Agenda recorrente"],
    ["pricing", "group_pricing_policies", "Mensalidades e valores avulsos"],
    ["billing", "member_billing_terms", "Classificação financeira"],
  ] as const)(
    "loads only the selected %s area",
    async (section, table, title) => {
      const html = renderToStaticMarkup(
        await OperationsPanel({ ...props, role: "owner", section }),
      );
      expect(html).toContain(title);
      expect(filters.map((f) => f.table)).toEqual([table]);
      expect((html.match(/<h2/g) ?? []).length).toBe(1);
    },
  );
  it.each([
    ["schedulePage", "schedule"],
    ["pricePage", "finance"],
    ["billingPage", "members"],
    ["membersPage", "members"],
  ] as const)("keeps %s pagination inside its section", (field, area) => {
    const html = renderToStaticMarkup(
      createElement(SettingsPager, {
        slug: "alpha",
        query: { membersPage: "2" },
        field,
        page: 1,
        count: 25,
      }),
    );
    expect(html).toContain(`/groups/alpha/settings/${area}?`);
    expect(html).toContain(`${field}=2`);
  });
});
