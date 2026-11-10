import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  load: vi.fn(),
  from: vi.fn(),
  terminal: vi.fn(),
  writes: [] as { table: string; verb: string; values: unknown }[],
  filters: [] as { table: string; column: string; value: unknown }[],
  revalidate: vi.fn(),
}));
vi.mock("@/features/groups/server", () => ({ loadGroup: m.load }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: (e: Error) => {
    if (e instanceof Error && e.message.startsWith("NEXT_")) throw e;
  },
}));
import {
  saveSchedule,
  deactivateSchedule,
  createVenue,
  savePricing,
  saveBilling,
  endPricing,
  endBilling,
} from "@/features/groups/operations/actions";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const group = id(1),
  row = id(2),
  player = id(3),
  other = id(4);
function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
const schedule = {
  weekday: "1",
  starts_at_local: "19:00",
  duration_minutes: "90",
  recurrence_type: "weekly",
  starts_on: "2026-11-16",
  is_active: "on",
};
const pricing = {
  monthly_enabled: "on",
  monthly_amount: "80,01",
  due_day: "10",
  effective_from: "2026-11-16",
};
const billing = {
  player_id: player,
  billing_type: "casual",
  effective_from: "2026-11-16",
};
function role(role: string) {
  m.load.mockResolvedValue({
    db: { from: m.from },
    group: { id: group, timezone: "UTC" },
    role,
  });
}
describe("operational actions — SDK mocked, no remote mutations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
    vi.clearAllMocks();
    m.writes.length = 0;
    m.filters.length = 0;
    role("owner");
    m.terminal.mockResolvedValue({ error: null, data: { id: row } });
    m.from.mockImplementation((table: string) => {
      const q = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        eq: vi.fn(),
        is: vi.fn(),
        single: m.terminal,
        maybeSingle: m.terminal,
      };
      q.select.mockReturnValue(q);
      q.is.mockReturnValue(q);
      q.insert.mockImplementation((values: unknown) => {
        m.writes.push({ table, verb: "insert", values });
        return q;
      });
      q.update.mockImplementation((values: unknown) => {
        m.writes.push({ table, verb: "update", values });
        return q;
      });
      q.eq.mockImplementation((column: string, value: unknown) => {
        m.filters.push({ table, column, value });
        return q;
      });
      return q;
    });
  });
  afterEach(() => vi.useRealTimers());
  it.each(["owner", "admin"])(
    "allows %s to save and deactivate schedules",
    async (r) => {
      role(r);
      expect(
        (
          await saveSchedule(
            "alpha",
            null,
            {},
            form({ ...schedule, group_id: other, id: other }),
          )
        ).message,
      ).toBeTruthy();
      expect(m.writes[0].values).toMatchObject({
        group_id: group,
        interval_weeks: 1,
      });
      expect(m.writes[0].values).not.toHaveProperty("id");
      expect((await deactivateSchedule("alpha", row, {})).message).toBeTruthy();
      expect(m.filters).toContainEqual({
        table: "group_schedules",
        column: "group_id",
        value: group,
      });
    },
  );
  it.each(["player", "guest"])(
    "denies all operational writes from %s",
    async (r) => {
      role(r);
      for (const result of [
        await saveSchedule("alpha", null, {}, form(schedule)),
        await deactivateSchedule("alpha", row, {}),
        await createVenue("alpha", {}, form({ name: "Local sintético" })),
        await savePricing("alpha", null, {}, form(pricing)),
        await saveBilling("alpha", null, {}, form(billing)),
        await endPricing(
          "alpha",
          row,
          {},
          form({ effective_until: "2026-11-20" }),
        ),
        await endBilling(
          "alpha",
          row,
          {},
          form({ effective_until: "2026-11-20" }),
        ),
      ])
        expect(result.error).toBeTruthy();
      expect(m.from).not.toHaveBeenCalled();
    },
  );
  it("denies price creation and closing to admin before touching rows", async () => {
    role("admin");
    expect(
      (await savePricing("alpha", null, {}, form(pricing))).error,
    ).toContain("proprietário");
    expect(
      (
        await endPricing(
          "alpha",
          row,
          {},
          form({ effective_until: "2026-11-20" }),
        )
      ).error,
    ).toContain("proprietário");
    expect(m.writes).toEqual([]);
  });
  it("validates venue ownership before schedule insertion", async () => {
    m.terminal.mockResolvedValue({ error: null, data: null });
    expect(
      (
        await saveSchedule(
          "alpha",
          null,
          {},
          form({ ...schedule, venue_id: other }),
        )
      ).error,
    ).toContain("deste grupo");
    expect(m.writes).toEqual([]);
    expect(m.filters).toContainEqual({
      table: "venues",
      column: "group_id",
      value: group,
    });
  });
  it("writes explicit integer prices with only the authorized tenant", async () => {
    expect(
      (
        await savePricing(
          "alpha",
          null,
          {},
          form({ ...pricing, group_id: other, monthly_amount_cents: "999" }),
        )
      ).message,
    ).toBeTruthy();
    expect(m.writes[0].values).toMatchObject({
      group_id: group,
      monthly_amount_cents: 8001,
      casual_amount_cents: null,
      due_day: 10,
    });
  });
  it("does not overwrite a current policy", async () => {
    m.terminal.mockResolvedValue({
      error: null,
      data: { effective_from: "2026-11-10", effective_until: null },
    });
    expect(
      (await savePricing("alpha", row, {}, form(pricing))).error,
    ).toContain("iniciada");
    expect(m.writes).toEqual([]);
  });
  it("edits only a future pricing version", async () => {
    m.terminal
      .mockResolvedValueOnce({
        error: null,
        data: { effective_from: "2026-11-16", effective_until: null },
      })
      .mockResolvedValueOnce({ error: null, data: { id: row } });
    expect(
      (await savePricing("alpha", row, {}, form(pricing))).message,
    ).toBeTruthy();
    expect(m.writes[0].values).not.toHaveProperty("group_id");
    expect(m.filters).toContainEqual({
      table: "group_pricing_policies",
      column: "id",
      value: row,
    });
  });
  it.each(["owner", "admin"])(
    "allows %s classification without trusting a changed player ID",
    async (r) => {
      role(r);
      m.terminal
        .mockResolvedValueOnce({
          error: null,
          data: {
            player_id: player,
            effective_from: "2026-11-16",
            effective_until: null,
          },
        })
        .mockResolvedValueOnce({
          error: null,
          data: { role: "player", players: { deleted_at: null } },
        })
        .mockResolvedValueOnce({ error: null, data: { id: row } });
      expect(
        (
          await saveBilling(
            "alpha",
            row,
            {},
            form({ ...billing, player_id: other }),
          )
        ).message,
      ).toBeTruthy();
      expect(m.filters).toContainEqual({
        table: "group_members",
        column: "player_id",
        value: player,
      });
      expect(m.writes[0].values).not.toHaveProperty("player_id");
    },
  );
  it("blocks a foreign or inactive member", async () => {
    m.terminal.mockResolvedValue({ error: null, data: null });
    expect(
      (await saveBilling("alpha", null, {}, form(billing))).error,
    ).toContain("deste grupo");
    expect(m.writes).toEqual([]);
  });
  it("blocks monthly classification of a guest", async () => {
    m.terminal.mockResolvedValue({
      error: null,
      data: { role: "guest", players: { deleted_at: null } },
    });
    expect(
      (
        await saveBilling(
          "alpha",
          null,
          {},
          form({ ...billing, billing_type: "monthly" }),
        )
      ).error,
    ).toContain("avulsos");
    expect(m.writes).toEqual([]);
  });
  it("preserves current classification content", async () => {
    m.terminal.mockResolvedValue({
      error: null,
      data: {
        player_id: player,
        effective_from: "2026-11-01",
        effective_until: null,
      },
    });
    expect(
      (await saveBilling("alpha", row, {}, form(billing))).error,
    ).toContain("histórica");
    expect(m.writes).toEqual([]);
  });
  it.each([
    { error: { code: "23P01" }, data: null },
    { error: null, data: null },
  ])("never confirms failed/zero-row writes", async (outcome) => {
    m.terminal.mockResolvedValue(outcome);
    const result = await saveSchedule("alpha", row, {}, form(schedule));
    expect(result.error).toBeTruthy();
    expect(result.message).toBeUndefined();
    expect(m.revalidate).not.toHaveBeenCalled();
  });
  it("preserves redirects/not-found instead of swallowing routing exceptions", async () => {
    m.load.mockRejectedValue(Error("NEXT_NOT_FOUND"));
    await expect(
      saveSchedule("foreign", null, {}, form(schedule)),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(m.writes).toEqual([]);
  });
  it("sanitizes transport errors with no false success", async () => {
    m.terminal.mockRejectedValue(Error("private transport details"));
    const result = await saveSchedule("alpha", null, {}, form(schedule));
    expect(result.message).toBeUndefined();
    expect(result.error).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("private transport");
  });
  it("ends only a future date on an existing version and never inserts a replacement", async () => {
    m.terminal
      .mockResolvedValueOnce({
        error: null,
        data: { effective_from: "2026-11-01", effective_until: null },
      })
      .mockResolvedValueOnce({ error: null, data: { id: row } });
    expect(
      (
        await endPricing(
          "alpha",
          row,
          {},
          form({ effective_until: "2026-11-20", monthly_amount: "1" }),
        )
      ).message,
    ).toContain("sem criação");
    expect(m.writes).toEqual([
      {
        table: "group_pricing_policies",
        verb: "update",
        values: { effective_until: "2026-11-20" },
      },
    ]);
  });
  it("does not reopen ended classification history", async () => {
    m.terminal.mockResolvedValue({
      error: null,
      data: { effective_from: "2026-11-01", effective_until: "2026-11-10" },
    });
    expect(
      (
        await endBilling(
          "alpha",
          row,
          {},
          form({ effective_until: "2026-11-20" }),
        )
      ).error,
    ).toContain("Histórico");
    expect(m.writes).toEqual([]);
  });
});
