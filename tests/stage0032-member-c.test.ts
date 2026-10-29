import { describe, expect, it } from "vitest";
import {
  MEMBER_C_FIXTURE as f,
  assertCIdentity,
  assertMemberFixture,
  classifyDenied,
  snapshotFingerprint,
} from "../scripts/stage0032-member-c-checks.mjs";
function fixture() {
  return {
    profile: { id: f.user },
    group: {
      id: f.groupA,
      slug: f.slugA,
      created_by: "synthetic-owner",
      deleted_at: null,
    },
    players: [
      { id: "c-player", user_id: f.user, deleted_at: null },
      { id: "owner-player", user_id: "synthetic-owner", deleted_at: null },
      {
        id: "guest-player",
        user_id: null,
        origin_group_id: f.groupA,
        deleted_at: null,
      },
    ],
    members: [
      {
        id: f.member,
        group_id: f.groupA,
        player_id: "c-player",
        role: "player",
        status: "active",
      },
      {
        id: "owner-member",
        group_id: f.groupA,
        player_id: "owner-player",
        role: "owner",
        status: "active",
      },
      {
        id: "guest-member",
        group_id: f.groupA,
        player_id: "guest-player",
        role: "guest",
        status: "active",
      },
    ],
  };
}
describe("C identity and fixture guards (no Auth or real JWT)", () => {
  it("requires the exact confirmed account", () => {
    expect(() =>
      assertCIdentity({ id: f.user, email_confirmed_at: "2026-10-26" }),
    ).not.toThrow();
    expect(() =>
      assertCIdentity({ id: "other", email_confirmed_at: "2026-10-26" }),
    ).toThrow();
    expect(() =>
      assertCIdentity({ id: f.user, email_confirmed_at: null }),
    ).toThrow();
  });
  it("accepts only an existing common membership and original owner", () => {
    expect(() => assertMemberFixture(fixture())).not.toThrow();
  });
  it.each(["admin", "owner", "guest"])("rejects C role %s", (role) => {
    const s = fixture();
    s.members[0].role = role;
    expect(() => assertMemberFixture(s)).toThrow();
  });
  it("rejects foreign group and inactive membership", () => {
    const s = fixture();
    s.group.id = f.groupB;
    expect(() => assertMemberFixture(s)).toThrow();
    const t = fixture();
    t.members[0].status = "suspended";
    expect(() => assertMemberFixture(t)).toThrow();
  });
  it("rejects two owners and owner replacement", () => {
    const s = fixture();
    s.members[2].role = "owner";
    expect(() => assertMemberFixture(s)).toThrow();
    const t = fixture();
    t.players[1].user_id = "replacement";
    expect(() => assertMemberFixture(t)).toThrow();
  });
});
describe("expected authorization denials", () => {
  it("accepts 42501/403 without retaining server messages", () => {
    const r = classifyDenied({
      status: 403,
      error: { code: "42501", message: "private-token tester@example.test" },
    });
    expect(r).toMatchObject({ passed: true, category: "authorization_denied" });
    expect(JSON.stringify(r)).not.toMatch(/private-token|example/);
  });
  it("accepts empty direct DML results but not empty RPC success", () => {
    expect(
      classifyDenied({ status: 200, data: [], error: null }, true).passed,
    ).toBe(true);
    expect(
      classifyDenied({ status: 200, data: [], error: null }, false).passed,
    ).toBe(false);
    expect(
      classifyDenied(
        { status: 200, data: [{ id: "changed" }], error: null },
        true,
      ).passed,
    ).toBe(false);
  });
  it.each(["23514", "23503", "23505", "PGRST202", "PGRST301"])(
    "does not call unexpected code %s a passing authorization test",
    (code) => {
      expect(classifyDenied({ status: 400, error: { code } }).passed).toBe(
        false,
      );
    },
  );
  it("does not accept a failed or expired authentication as authorization proof", () => {
    expect(
      classifyDenied({ status: 401, error: { code: "42501" } }),
    ).toMatchObject({ passed: false, category: "authentication" });
  });
  it("does not accept 404/null response as an authorized denial", () => {
    expect(classifyDenied({ status: 404, data: [] }, true).passed).toBe(false);
    expect(classifyDenied({ status: 204, data: null }, true).passed).toBe(
      false,
    );
    expect(classifyDenied(undefined, true).passed).toBe(false);
  });
});
describe("persistent integrity snapshots", () => {
  it("ignores object key and row ordering", () => {
    const a = fixture(),
      b = fixture();
    b.members.reverse();
    b.players.reverse();
    expect(snapshotFingerprint(a)).toBe(snapshotFingerprint(b));
  });
  it.each(["role", "status", "group", "member_deleted", "profile"])(
    "detects %s mutation",
    (mutation) => {
      const a = fixture(),
        b = fixture();
      if (mutation === "role") b.members[0].role = "admin";
      if (mutation === "status") b.members[1].status = "left";
      if (mutation === "group") b.group.slug = "changed";
      if (mutation === "member_deleted") b.members.pop();
      if (mutation === "profile") b.profile.id = "changed";
      expect(snapshotFingerprint(a)).not.toBe(snapshotFingerprint(b));
    },
  );
});
