import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const MEMBER_C_FIXTURE = Object.freeze({
  user: "111e7247-9007-41ce-a594-da1665e785e6",
  groupA: "45792949-85ee-4149-9398-c3d0e894676e",
  groupB: "8a332978-f572-4345-9073-f46a4ca7809d",
  member: "49f6781c-b0c7-4735-ba1c-e34fb8a6871f",
  slugA: "audit-0032-a-8467145b-fb16-4cbd-89f5-3cf149b3a830",
});
export function assertCIdentity(user) {
  assert(
    user?.id === MEMBER_C_FIXTURE.user && user.email_confirmed_at,
    "Confirmed technical C identity required",
  );
}
export function assertMemberFixture(s) {
  const f = MEMBER_C_FIXTURE;
  assert(
    s.profile?.id === f.user &&
      s.group?.id === f.groupA &&
      s.group.slug === f.slugA &&
      !s.group.deleted_at,
    "Unexpected profile or synthetic group",
  );
  const own = s.players.filter((p) => p.user_id === f.user && !p.deleted_at);
  assert(own.length === 1, "Expected one active technical player");
  const c = s.members.find((m) => m.id === f.member);
  assert(
    c &&
      c.group_id === f.groupA &&
      c.player_id === own[0].id &&
      c.role === "player" &&
      c.status === "active",
    "Common member fixture must already exist unchanged",
  );
  const owners = s.members.filter(
    (m) => m.role === "owner" && m.status === "active",
  );
  assert(owners.length === 1, "Exactly one active owner required");
  const owner = s.players.find((p) => p.id === owners[0].player_id);
  assert(
    owner?.user_id &&
      owner.user_id === s.group.created_by &&
      owner.user_id !== f.user,
    "Original synthetic owner must remain owner",
  );
}
function canonical(value) {
  if (Array.isArray(value))
    return value
      .map(canonical)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
export function snapshotFingerprint(snapshot) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(snapshot)))
    .digest("hex");
}
export function classifyDenied(result, allowEmpty = false) {
  const status = Number.isInteger(result?.status) ? result.status : null;
  if (result?.error) {
    const code = [
      "42501",
      "23514",
      "23503",
      "23505",
      "PGRST202",
      "PGRST301",
    ].includes(result.error.code)
      ? result.error.code
      : "other";
    return {
      passed: code === "42501" && status === 403,
      category:
        status === 401
          ? "authentication"
          : code === "42501" && status === 403
            ? "authorization_denied"
            : "unexpected_error",
      status,
      code,
    };
  }
  const empty =
    allowEmpty &&
    status >= 200 &&
    status < 300 &&
    Array.isArray(result?.data) &&
    result.data.length === 0;
  return {
    passed: empty,
    category: empty ? "rls_no_affected_rows" : "unexpected_success_or_response",
    status,
    code: null,
  };
}
