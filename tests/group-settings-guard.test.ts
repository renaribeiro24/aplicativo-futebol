import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ identity: vi.fn(), single: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/identity/server", () => ({ loadIdentity: m.identity }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("not-found");
  },
}));
import { loadManagedGroup } from "@/features/groups/server";
describe("administration route guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      maybeSingle: m.single,
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.is.mockReturnValue(chain);
    m.identity.mockResolvedValue({
      player: { id: "synthetic-player" },
      db: { from: () => chain },
    });
  });
  it.each(["owner", "admin"])("accepts active %s membership", async (role) => {
    m.single
      .mockResolvedValueOnce({ data: { id: "fixture-a" }, error: null })
      .mockResolvedValueOnce({ data: { role }, error: null });
    expect((await loadManagedGroup("alpha")).role).toBe(role);
  });
  it.each(["player", "guest"])("returns not-found to %s", async (role) => {
    m.single
      .mockResolvedValueOnce({ data: { id: "fixture-a" }, error: null })
      .mockResolvedValueOnce({ data: { role }, error: null });
    await expect(loadManagedGroup("alpha")).rejects.toThrow("not-found");
  });
  it("denies a foreign group invisible under RLS", async () => {
    m.single.mockResolvedValueOnce({ data: null, error: null });
    await expect(loadManagedGroup("foreign")).rejects.toThrow("not-found");
  });
  it("fails closed on a membership lookup error", async () => {
    m.single
      .mockResolvedValueOnce({ data: { id: "fixture-a" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "failure" } });
    await expect(loadManagedGroup("alpha")).rejects.toThrow(
      "verificar seu vínculo",
    );
  });
});
