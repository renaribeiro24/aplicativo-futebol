import { describe, expect, it } from "vitest";
import { parseSupabaseConfig } from "@/lib/supabase/config";
import {
  getSiteOrigin,
  isValidSignup,
  readCredentials,
} from "@/features/auth/validation";
const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture",
};
describe("configuration fails closed", () => {
  it("supports an unconfigured checkout", () =>
    expect(parseSupabaseConfig({})).toBeNull());
  it("accepts only a public key and normalized origin", () =>
    expect(parseSupabaseConfig(valid)).toEqual({
      url: valid.NEXT_PUBLIC_SUPABASE_URL,
      key: valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    }));
  it.each([
    "sb_secret_test",
    "service_role",
    "eyJhbGciOiJIUzI1NiJ9.fake.signature",
    "",
  ])("rejects non-publishable credentials: %s", (key) => {
    expect(
      parseSupabaseConfig({
        ...valid,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
      }),
    ).toBeNull();
  });
  it.each([
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com?key=value",
    "not-a-url",
  ])("rejects invalid project origins: %s", (url) => {
    expect(
      parseSupabaseConfig({ ...valid, NEXT_PUBLIC_SUPABASE_URL: url }),
    ).toBeNull();
  });
  it("allows local HTTP for future local Supabase", () => {
    expect(
      parseSupabaseConfig({
        ...valid,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).not.toBeNull();
  });
});
describe("auth inputs", () => {
  it("normalizes email without modifying passwords", () => {
    const form = new FormData();
    form.set("email", " player@example.test ");
    form.set("password", " pass word ");
    expect(readCredentials(form)).toEqual({
      email: "player@example.test",
      password: " pass word ",
    });
  });
  it("validates signup without depending on a remote project", () => {
    expect(isValidSignup("person@example.test", "long-password")).toBe(true);
    expect(isValidSignup("invalid", "long-password")).toBe(false);
    expect(isValidSignup("person@example.test", "short")).toBe(false);
  });
  it("never builds callbacks from untrusted origins", () => {
    expect(getSiteOrigin(undefined)).toBeNull();
    expect(getSiteOrigin("javascript:alert(1)")).toBeNull();
    expect(getSiteOrigin("http://example.test")).toBeNull();
    expect(getSiteOrigin("https://user:pass@example.test")).toBeNull();
    expect(getSiteOrigin("https://example.test/path")).toBeNull();
    expect(getSiteOrigin("https://app.example.test/")).toBe(
      "https://app.example.test",
    );
    expect(getSiteOrigin("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });
});
