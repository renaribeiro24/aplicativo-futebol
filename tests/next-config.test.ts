import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
  PHASE_TEST,
} from "next/constants";
import { isCsrfOriginAllowed } from "next/dist/server/app-render/csrf-protection";
import nextConfig from "../next.config";

const name = "refactored-space-tribble-6v4w4wj7p4vx36w6";
const hostname = `${name}-3000.app.github.dev`;
beforeEach(() => {
  vi.stubEnv("CODESPACES", "true");
  vi.stubEnv("CODESPACE_NAME", name);
  vi.stubEnv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", "app.github.dev");
  vi.stubEnv("VERCEL", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("Codespaces development origin exception", () => {
  it("trusts only the exact local Origin and current Codespace dev asset host", () => {
    expect(nextConfig(PHASE_DEVELOPMENT_SERVER)).toEqual({
      allowedDevOrigins: [hostname],
      experimental: { serverActions: { allowedOrigins: ["localhost:3000"] } },
    });
  });
  it.each([PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER, PHASE_TEST])(
    "adds no overrides in phase %s, even with Codespaces variables",
    (phase) => {
      expect(nextConfig(phase)).toEqual({});
    },
  );
  it.each([undefined, "false", "1"])(
    "leaves ordinary development untouched: %s",
    (value) => {
      vi.stubEnv("CODESPACES", value);
      expect(nextConfig(PHASE_DEVELOPMENT_SERVER)).toEqual({});
    },
  );
  it("leaves Vercel untouched even with conflicting Codespaces environment", () => {
    vi.stubEnv("VERCEL", "1");
    expect(nextConfig(PHASE_DEVELOPMENT_SERVER)).toEqual({});
  });
  it.each([
    undefined,
    "",
    "*",
    "a.b",
    "https://space",
    "space:3000",
    "-space",
    "space-",
    "a".repeat(59),
  ])("fails closed for invalid Codespace name: %s", (value) => {
    vi.stubEnv("CODESPACE_NAME", value);
    expect(nextConfig(PHASE_DEVELOPMENT_SERVER)).toEqual({});
  });
  it.each([
    "*.app.github.dev",
    "app.github.dev.evil.test",
    "evil.test",
    "https://app.github.dev",
  ])("does not trust arbitrary forwarding domains: %s", (value) => {
    vi.stubEnv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", value);
    expect(nextConfig(PHASE_DEVELOPMENT_SERVER)).toEqual({});
  });
  it("supports the default Codespaces forwarding domain when the variable is absent", () => {
    vi.stubEnv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", undefined);
    expect(nextConfig(PHASE_DEVELOPMENT_SERVER).allowedDevOrigins).toEqual([
      hostname,
    ]);
  });
  it("uses Next 16's actual CSRF matcher to accept the reported Origin", () => {
    const origins = nextConfig(PHASE_DEVELOPMENT_SERVER).experimental
      ?.serverActions;
    expect(isCsrfOriginAllowed("localhost:3000")).toBe(false);
    expect(
      isCsrfOriginAllowed(
        "localhost:3000",
        origins && typeof origins === "object"
          ? origins.allowedOrigins
          : undefined,
      ),
    ).toBe(true);
  });
  it.each([
    "evil.test",
    "localhost:3001",
    "127.0.0.1:3000",
    "other-3000.app.github.dev",
    hostname,
    "localhost:3000.evil.test",
  ])("does not add a CSRF exception for %s", (origin) => {
    const actions = nextConfig(PHASE_DEVELOPMENT_SERVER).experimental
      ?.serverActions;
    expect(
      isCsrfOriginAllowed(
        origin,
        actions && typeof actions === "object"
          ? actions.allowedOrigins
          : undefined,
      ),
    ).toBe(false);
  });
});
