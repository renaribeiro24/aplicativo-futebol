import { describe, it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({
  client: vi.fn(),
  g: vi.fn(),
  v: vi.fn(),
  filters: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.client }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NEXT_NOT_FOUND");
  },
}));
import { readLocationState } from "@/features/groups/location/server";
import type { loadManagedGroup } from "@/features/groups/server";
const context = { role: "owner", group: { id: "synthetic-group" } } as Awaited<
  ReturnType<typeof loadManagedGroup>
>;
beforeEach(() => {
  vi.clearAllMocks();
  m.g.mockResolvedValue({ data: { primary_venue_id: null }, error: null });
  m.v.mockResolvedValue({ data: [], error: null });
  m.client.mockResolvedValue({
    from: (table: string) => {
      const q = {
        select: vi.fn(),
        eq: m.filters,
        is: vi.fn(),
        order: vi.fn(),
        limit: m.v,
        maybeSingle: m.g,
      };
      q.select.mockReturnValue(q);
      q.eq.mockReturnValue(q);
      q.is.mockReturnValue(q);
      q.order.mockReturnValue(q);
      expect(["groups", "venues"]).toContain(table);
      return q;
    },
  });
});
describe("schema capability and private loading", () => {
  it("is ready only after successful authorized new-schema reads", async () => {
    expect((await readLocationState(context)).ready).toBe(true);
    expect(m.filters).toHaveBeenCalledWith("group_id", "synthetic-group");
  });
  it.each(["42703", "PGRST204"])(
    "recognizes only missing-schema capability %s",
    async (code) => {
      m.g.mockResolvedValue({ data: null, error: { code } });
      expect((await readLocationState(context)).ready).toBe(false);
    },
  );
  it.each(["42501", "PGRST301", "network"])(
    "fails closed on auth/network error %s without pretending an empty location",
    async (code) => {
      m.v.mockResolvedValue({ data: null, error: { code } });
      await expect(readLocationState(context)).rejects.toThrow(
        "Não foi possível consultar",
      );
    },
  );
  it("does not disguise authorization errors as a missing migration", async () => {
    m.g.mockResolvedValue({ data: null, error: { code: "42703" } });
    m.v.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(readLocationState(context)).rejects.toThrow(
      "Não foi possível consultar",
    );
  });
  it.each(["player", "guest"])(
    "rejects %s before creating the future client",
    async (role) => {
      await expect(readLocationState({ ...context, role })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(m.client).not.toHaveBeenCalled();
    },
  );
});
