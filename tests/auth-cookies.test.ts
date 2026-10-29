import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthCookieOptions } from "@/lib/supabase/cookies";

afterEach(() => vi.unstubAllEnvs());
describe("Auth cookie transport", () => {
  it("requires Secure in production even with missing or invalid site config", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const site of ["", "invalid", "http://localhost:3000"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", site);
      expect(getAuthCookieOptions()).toEqual({ secure: true });
    }
  });
  it("requires Secure for HTTPS Codespaces/dev and Preview", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dev.example.test");
    expect(getAuthCookieOptions()).toEqual({ secure: true });
  });
  it("preserves HTTP localhost in development without changing session identity", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    expect(getAuthCookieOptions()).toEqual({ secure: false });
  });
});
