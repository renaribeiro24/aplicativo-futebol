import { describe, it, expect } from "vitest";
import {
  slugify,
  validSlug,
  validName,
  validPosition,
  validTimezone,
  validRequestId,
  canManage,
  mutationError,
} from "@/features/groups/validation";
import {
  isValidSignup,
  isValidEmail,
  getSiteOrigin,
} from "@/features/auth/validation";
describe("stage003 form validation", () => {
  it("normalizes a suggested slug while preserving explicit validation", () => {
    expect(slugify("Futebol São João! 2026")).toBe("futebol-sao-joao-2026");
    expect(validSlug("aa")).toBe(false);
    expect(validSlug("bad--slug")).toBe(false);
    expect(validSlug("valid-group")).toBe(true);
  });
  it("bounds names and rejects invalid sports positions", () => {
    expect(validName("")).toBe(false);
    expect(validName("x".repeat(101))).toBe(false);
    expect(validPosition("owner")).toBe(false);
    expect(validPosition("defender")).toBe(true);
  });
  it("validates timezone and request identities", () => {
    expect(validTimezone("America/Sao_Paulo")).toBe(true);
    expect(validTimezone("Invalid/Zone")).toBe(false);
    expect(validRequestId("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(validRequestId("arbitrary")).toBe(false);
  });
  it("recognizes only group managers", () => {
    expect(canManage("owner")).toBe(true);
    expect(canManage("admin")).toBe(true);
    expect(canManage("player")).toBe(false);
    expect(canManage(null)).toBe(false);
  });
  it("does not expose internal errors", () => {
    expect(mutationError("23505")).toContain("identificador");
    expect(mutationError("42501")).toContain("permissão");
    expect(mutationError("internal details")).not.toContain("internal details");
  });
  it("validates email/password without weakening callback origin", () => {
    expect(isValidEmail("a@b.test")).toBe(true);
    expect(isValidSignup("a@b.test", "short")).toBe(false);
    expect(isValidSignup("a@b.test", "x".repeat(129))).toBe(false);
    expect(getSiteOrigin("https://app.test/evil")).toBeNull();
  });
});
