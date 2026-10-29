import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ config: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: mocks.config }));
vi.mock("@/features/auth/session", () => ({ getCurrentUser: mocks.user }));
import { GET } from "@/app/api/me/route";
describe("GET /api/me", () => {
  beforeEach(() => {
    mocks.config.mockReturnValue({});
    mocks.user.mockResolvedValue(null);
  });
  it("returns 503 before configuration and never calls Auth", async () => {
    mocks.config.mockReturnValue(null);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(mocks.user).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("returns 401 without a verified user", async () =>
    expect((await GET()).status).toBe(401));
  it("returns only the authenticated user's public identity", async () => {
    mocks.user.mockResolvedValue({
      id: "fixture-id",
      email: "fixture@example.test",
      user_metadata: { role: "owner" },
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "fixture-id",
      email: "fixture@example.test",
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
