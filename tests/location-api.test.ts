import { describe, it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({
  user: vi.fn(),
  group: vi.fn(),
  configured: vi.fn(),
  search: vi.fn(),
}));
vi.mock("@/features/auth/session", () => ({ getCurrentUser: m.user }));
vi.mock("@/features/groups/server", () => ({ loadGroup: m.group }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  unstable_rethrow: (e: unknown) => {
    if (e instanceof Error && e.message === "NEXT_NOT_FOUND") throw e;
  },
}));
vi.mock("@/features/groups/location/provider", async (importOriginal) => {
  const p =
    await importOriginal<
      typeof import("@/features/groups/location/provider")
    >();
  return { ...p, searchConfigured: m.configured, searchLocations: m.search };
});
import { POST } from "@/app/api/groups/[slug]/locations/search/route";
let serial = 0;
const request = (
  body: unknown = { query: "Campo sintético" },
  type = "application/json",
) =>
  new Request("https://example.invalid/api/groups/alpha/locations/search", {
    method: "POST",
    headers: { "content-type": type },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const run = (r = request()) =>
  POST(r, { params: Promise.resolve({ slug: "alpha" }) });
beforeEach(() => {
  vi.clearAllMocks();
  m.user.mockResolvedValue({ id: "technical" });
  m.group.mockResolvedValue({
    role: "owner",
    user: { id: "technical-" + ++serial },
  });
  m.configured.mockReturnValue(true);
  m.search.mockResolvedValue([]);
});
describe("private search route (auth mocked, no remote calls)", () => {
  it.each(["owner", "admin"])(
    "allows %s and uses private/no-store",
    async (role) => {
      m.group.mockResolvedValue({
        role,
        user: { id: "technical-" + ++serial },
      });
      const r = await run();
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toBe("private, no-store");
      expect(m.search).toHaveBeenCalledWith("Campo sintético");
    },
  );
  it("rejects anonymous before provider/authenticated group reads", async () => {
    m.user.mockResolvedValue(null);
    expect((await run()).status).toBe(401);
    expect(m.group).not.toHaveBeenCalled();
    expect(m.search).not.toHaveBeenCalled();
  });
  it.each(["player", "guest"])(
    "denies %s before any paid call",
    async (role) => {
      m.group.mockResolvedValue({ role, user: { id: "technical" } });
      expect((await run()).status).toBe(403);
      expect(m.search).not.toHaveBeenCalled();
    },
  );
  it("retains not-found for another group without spending credits", async () => {
    m.group.mockRejectedValue(Error("NEXT_NOT_FOUND"));
    await expect(run()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(m.search).not.toHaveBeenCalled();
  });
  it("offers manual fallback when unconfigured", async () => {
    m.configured.mockReturnValue(false);
    const r = await run();
    expect(r.status).toBe(503);
    expect((await r.json()).error).toContain("manualmente");
    expect(m.search).not.toHaveBeenCalled();
  });
  it.each([
    () => request({ query: "x" }),
    () => request("not json"),
    () => request("a".repeat(1025)),
    () => request({ query: "a".repeat(201) }),
  ])("rejects malformed or excessive input", async (make) => {
    expect((await run(make())).status).toBe(400);
    expect(m.search).not.toHaveBeenCalled();
  });
  it("rejects non-JSON content-type", async () => {
    expect((await run(request({}, "text/plain"))).status).toBe(415);
    expect(m.search).not.toHaveBeenCalled();
  });
  it("bounds per-instance user credits", async () => {
    for (let i = 0; i < 12; i++) expect((await run()).status).toBe(200);
    expect((await run()).status).toBe(429);
    expect(m.search).toHaveBeenCalledTimes(12);
  });
  it("never exposes upstream error details", async () => {
    m.search.mockRejectedValue(Error("secret key in upstream URL"));
    const r = await run();
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toContain("secret key");
  });
});
