import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  group: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/features/groups/server", () => ({ loadGroup: m.group }));
vi.mock("@/features/identity/server", () => ({ loadIdentity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import { updateGroupDetails } from "@/features/groups/actions";
function form(extra: Record<string, string | undefined> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: "Turma sintética",
    description: "Encontro local",
    timezone: "America/Sao_Paulo",
    ...extra,
  })) {
    if (typeof value === "string") data.set(key, value);
  }
  return data;
}
describe("group settings mutations — SDK mocked, not a remote persistence proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.group.mockResolvedValue({
      db: { from: m.from },
      group: { id: "fixture-a" },
      role: "owner",
    });
    m.from.mockReturnValue({ update: m.update });
    m.update.mockReturnValue({ eq: m.eq });
    m.eq.mockReturnValue({ is: m.is });
    m.is.mockReturnValue({ select: m.select });
    m.select.mockReturnValue({ maybeSingle: m.single });
    m.single.mockResolvedValue({ error: null, data: { id: "fixture-a" } });
  });
  it.each(["owner", "admin"])(
    "allows %s and writes only the three permitted fields",
    async (role) => {
      m.group.mockResolvedValue({
        db: { from: m.from },
        group: { id: "fixture-a" },
        role,
      });
      const result = await updateGroupDetails(
        "alpha",
        {},
        form({
          group_id: "fixture-b",
          role: "owner",
          slug: "other",
          monthly_amount_cents: "1",
        }),
      );
      expect(result.message).toBeTruthy();
      expect(m.update).toHaveBeenCalledWith({
        name: "Turma sintética",
        description: "Encontro local",
        timezone: "America/Sao_Paulo",
      });
      expect(m.eq).toHaveBeenCalledWith("id", "fixture-a");
      expect(m.revalidate.mock.calls.map((c) => c[0])).toEqual([
        "/dashboard",
        "/groups/alpha",
        "/groups/alpha/settings",
      ]);
    },
  );
  it.each(["player", "guest", null, "organizer"])(
    "denies forged requests from %s",
    async (role) => {
      m.group.mockResolvedValue({ role, group: { id: "fixture-a" } });
      expect(
        (await updateGroupDetails("alpha", {}, form())).error,
      ).toBeTruthy();
      expect(m.from).not.toHaveBeenCalled();
    },
  );
  it.each([
    { name: " " },
    { description: "x".repeat(1001) },
    { timezone: "" },
    { timezone: "invalid-zone" },
  ])("rejects invalid input before loading a group", async (values) => {
    expect(
      (await updateGroupDetails("alpha", {}, form(values))).error,
    ).toBeTruthy();
    expect(m.group).not.toHaveBeenCalled();
  });
  it.each([
    { error: { code: "42501" }, data: null },
    { error: null, data: null },
  ])(
    "does not report success for denial or zero updated rows",
    async (result) => {
      m.single.mockResolvedValue(result);
      const state = await updateGroupDetails("alpha", {}, form());
      expect(state.error).toBeTruthy();
      expect(state.message).toBeUndefined();
      expect(m.revalidate).not.toHaveBeenCalled();
    },
  );
  it("sanitizes transport failures", async () => {
    m.single.mockRejectedValue(new Error("private upstream detail"));
    const state = await updateGroupDetails("alpha", {}, form());
    expect(state.error).toBeTruthy();
    expect(JSON.stringify(state)).not.toContain("private upstream detail");
    expect(state.message).toBeUndefined();
  });
  it("does not bypass a missing or foreign tenant", async () => {
    m.group.mockRejectedValue(new Error("not-found"));
    await expect(updateGroupDetails("foreign", {}, form())).rejects.toThrow(
      "not-found",
    );
    expect(m.update).not.toHaveBeenCalled();
  });
});
