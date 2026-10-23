import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  user: vi.fn(),
  client: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: mocks.config }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
import { getCurrentUser, requireUser } from "@/features/auth/session";
describe("server session guard", () => {
  beforeEach(() => {
    mocks.config.mockReturnValue({});
    mocks.client.mockResolvedValue({ auth: { getUser: mocks.user } });
    mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  });
  it("does not create a client before configuration", async () => {
    mocks.config.mockReturnValue(null);
    expect(await getCurrentUser()).toBeNull();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("redirects when Auth rejects the user", async () => {
    mocks.user.mockResolvedValue({
      data: { user: { id: "forged" } },
      error: { message: "invalid token" },
    });
    await expect(requireUser()).rejects.toThrow("redirect:/login");
  });
  it("returns the server-verified user", async () => {
    mocks.user.mockResolvedValue({
      data: { user: { id: "verified-fixture" } },
      error: null,
    });
    expect(await requireUser()).toEqual({ id: "verified-fixture" });
  });
});
