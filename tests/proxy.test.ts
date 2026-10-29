import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), config: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createClient }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: mocks.config }));
import { refreshSession } from "@/lib/supabase/proxy";
import { proxy } from "../src/proxy";
const config = {
  url: "https://example.supabase.co",
  key: "sb_publishable_test_fixture",
};
const request = (path: string) =>
  new NextRequest(`https://app.example.test${path}`);
describe("session proxy", () => {
  beforeEach(() => {
    mocks.config.mockReturnValue(config);
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
      },
    });
  });
  it("skips the provider entirely without configuration", async () => {
    mocks.config.mockReturnValue(null);
    const response = await proxy(request("/dashboard"));
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("redirects anonymous nested dashboard requests", async () => {
    const response = await refreshSession(
      request("/dashboard/private"),
      config,
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example.test/login",
    );
  });
  it("does not turn API failures into HTML redirects", async () => {
    const response = await refreshSession(request("/api/me"), config);
    expect(response.headers.get("location")).toBeNull();
  });
  it("preserves refresh cookies and cache headers on redirects", async () => {
    mocks.createClient.mockImplementation((_url, _key, options) => ({
      auth: {
        getUser: async () => {
          options.cookies.setAll(
            [
              {
                name: "sb-fixture",
                value: "refreshed-fixture",
                options: { path: "/", sameSite: "lax" },
              },
            ],
            { Pragma: "no-cache", Expires: "0" },
          );
          return { data: { user: null }, error: null };
        },
      },
    }));
    const req = request("/dashboard");
    const response = await refreshSession(req, config);
    expect(req.cookies.get("sb-fixture")?.value).toBe("refreshed-fixture");
    expect(response.cookies.get("sb-fixture")?.value).toBe("refreshed-fixture");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(response.headers.get("Expires")).toBe("0");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
