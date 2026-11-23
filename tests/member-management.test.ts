import { describe, it, expect, vi } from "vitest";
import {
  emailValid,
  normalizeRecipient,
  tokenValid,
  uuidValid,
  invitationUrl,
  isManager,
  mayManageMember,
  mayPromote,
  memberError,
} from "@/features/members/validation";
import {
  invitationMessage,
  testInvitationTransport,
  liveDeliveryState,
} from "@/features/members/email";
describe("member management boundaries", () => {
  it.each(["owner", "admin"])("%s manages", (r) =>
    expect(isManager(r)).toBe(true),
  );
  it.each(["player", "guest", "external"])("%s cannot manage", (r) =>
    expect(isManager(r)).toBe(false),
  );
  it("only owner promotes active player", () => {
    expect(mayPromote("owner", "player", "active")).toBe(true);
    expect(mayPromote("admin", "player", "active")).toBe(false);
    expect(mayPromote("owner", "player", "suspended")).toBe(false);
    expect(mayPromote("owner", "guest", "active")).toBe(false);
  });
  it("admin manages players, never admins/owner", () => {
    expect(mayManageMember("admin", "player")).toBe(true);
    expect(mayManageMember("admin", "admin")).toBe(false);
    expect(mayManageMember("owner", "owner")).toBe(false);
  });
  it("normalizes exact email, never names", () => {
    expect(normalizeRecipient(" A@Example.invalid ")).toBe("a@example.invalid");
    expect(emailValid("a@example.invalid")).toBe(true);
    expect(emailValid("x\n@example.invalid")).toBe(false);
  });
  it.each(["", "abc", "a".repeat(63), "G".repeat(64)])(
    "rejects malformed token %s",
    (x) => expect(tokenValid(x)).toBe(false),
  );
  it("token only in fragment, never query/path", () => {
    const url = new URL(
      invitationUrl("https://example.invalid", "individual", "a".repeat(64)),
    );
    expect(url.search).toBe("");
    expect(url.pathname).toBe("/admissoes/individual");
    expect(url.hash).toContain("token=");
  });
  it.each([
    "https://example.invalid/path",
    "***example.invalid",
    "http://example.invalid",
    "https://example.invalid?next=x",
  ])("origin rejected %s", (o) =>
    expect(() => invitationUrl(o, "shared", "a".repeat(64))).toThrow(),
  );
  it("safe UUID validation", () => {
    expect(uuidValid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(uuidValid("x")).toBe(false);
  });
  it.each([
    "42501",
    "P4090",
    "P4091",
    "P4092",
    "P4290",
    "23514",
    "23P01",
    "PGRST202",
    undefined,
  ])("sanitized error %s", (c) => {
    expect(memberError(c)).not.toContain("token");
    expect(memberError(c).length).toBeGreaterThan(10);
  });
  it("email template escapes group markup", () => {
    expect(
      invitationMessage({
        recipient: "a@example.invalid",
        group: "<script>x</script>",
        origin: "https://example.invalid",
        token: "a".repeat(64),
      }).html,
    ).not.toContain("<script>");
  });
  it("live email cannot dispatch", () =>
    expect(liveDeliveryState().state).toBe("blocked"));
  it("mock provider acceptance is not delivery", async () => {
    const transport = vi.fn().mockResolvedValue({ id: "synthetic" });
    const msg = invitationMessage({
      recipient: "a@example.invalid",
      group: "Synthetic",
      origin: "https://example.invalid",
      token: "a".repeat(64),
    });
    expect(await testInvitationTransport(msg, transport)).toEqual({
      state: "accepted_by_provider",
    });
    expect(
      await testInvitationTransport(msg, async () => {
        throw Error("private provider details");
      }),
    ).toEqual({ state: "failed" });
  });
});
