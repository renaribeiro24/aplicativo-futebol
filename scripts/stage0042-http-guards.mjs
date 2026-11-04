import assert from "node:assert/strict";
import { snapshotFingerprint } from "./stage0032-member-c-checks.mjs";
export const PROJECT_URL = "https://hpbvtqvbtyioqjyelrpb.supabase.co";
export const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
  "TEST_USER_C_EMAIL",
  "TEST_USER_C_PASSWORD",
  "TEST_ACCOUNTS_ARE_SYNTHETIC",
  "TEST_ALLOW_CREATE_AUDIT_FIXTURES",
];
export function assertBranch(branch) {
  assert(
    branch === "develop" || branch === "test/stage0042-http",
    "Only develop or the authorized HTTP test branch is allowed",
  );
}
export function configuration(env) {
  return {
    present: Object.fromEntries(REQUIRED.map((k) => [k, Boolean(env[k])])),
    targetValid: env.NEXT_PUBLIC_SUPABASE_URL === PROJECT_URL,
    publishableKey: Boolean(
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_"),
    ),
    syntheticDeclaration: env.TEST_ACCOUNTS_ARE_SYNTHETIC === "1",
    creationAuthorized: env.TEST_ALLOW_CREATE_AUDIT_FIXTURES === "1",
  };
}
export function assertConfiguration(env) {
  const c = configuration(env);
  assert(
    Object.values(c.present).every(Boolean) &&
      c.targetValid &&
      c.publishableKey &&
      c.syntheticDeclaration &&
      c.creationAuthorized,
    "Configuration incomplete or unauthorized; run --check (values suppressed)",
  );
}
export function uuid(value) {
  assert(
    typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
    "Invalid fixture identifier",
  );
  return value;
}
export function assertIdentities(actors) {
  assert(
    actors.length === 3,
    "Three confirmed synthetic accounts are required",
  );
  for (const a of actors) {
    uuid(a.user.id);
    uuid(a.player);
    assert(
      a.user.email_confirmed_at && !a.user.is_anonymous && a.token,
      "Confirmed real Auth identity required",
    );
  }
  assert(
    new Set(actors.map((a) => a.user.id)).size === 3 &&
      new Set(actors.map((a) => a.player)).size === 3 &&
      new Set(actors.map((a) => a.token)).size === 3,
    "Distinct technical identities and sessions required",
  );
}
// Never accept validation/constraint/schema failures as evidence of denied authorization.
export function denied(result, codes = ["42501"], allowEmpty = false) {
  if (result.error)
    return (
      codes.includes(result.error.code) &&
      result.status >= 400 &&
      result.status < 500
    );
  return (
    allowEmpty &&
    result.status >= 200 &&
    result.status < 300 &&
    Array.isArray(result.data) &&
    result.data.length === 0
  );
}
export async function verifyDenied(
  operation,
  before,
  readAfter,
  codes = ["42501"],
  allowEmpty = false,
) {
  const result = await operation();
  // Read state even when the response is unexpected: a failed assertion must not hide writes.
  const after = await readAfter();
  assert.equal(
    snapshotFingerprint(after),
    snapshotFingerprint(before),
    "Integrity violation after prohibited operation",
  );
  assert(
    denied(result, codes, allowEmpty),
    "Operation was not denied for an expected reason",
  );
  return {
    status: result.status,
    code: result.error?.code ?? null,
    unchanged: true,
  };
}
export function validateManifest(m, run, actors) {
  uuid(run);
  assert(
    m.version === 1 && m.run === run && m.project === PROJECT_URL,
    "Wrong audit manifest",
  );
  assert(
    m.groups?.length === 2 && m.identities?.length === 3,
    "Incomplete fixture manifest",
  );
  m.groups.forEach((g, i) => {
    uuid(g.id);
    assert(
      g.slug === `audit-0042-${i === 0 ? "a" : "b"}-${run}`,
      "Unexpected synthetic group slug",
    );
  });
  assert(m.groups[0].id !== m.groups[1].id, "Groups must differ");
  for (let i = 0; i < 3; i++) {
    uuid(m.identities[i].user);
    uuid(m.identities[i].player);
    if (actors)
      assert(
        m.identities[i].user === actors[i].user.id &&
          m.identities[i].player === actors[i].player,
        "Account mismatch; do not reuse different credentials",
      );
  }
  assert(
    new Set(m.identities.map((a) => a.user)).size === 3,
    "Distinct accounts required",
  );
}
export function membershipSeed(m) {
  validateManifest(m, m.run);
  const [a, b, c] = m.identities,
    [ga, gb] = m.groups;
  // Only validated UUIDs and a fixed UUID-derived slug are interpolated. No user text/secrets.
  return `-- Private, one-time fixture setup; NOT a migration or an identity simulation.\n-- Review identifiers against the private manifest. Does not change existing links.\nBEGIN;\nDO $audit$ BEGIN\n  PERFORM 1 FROM public.groups WHERE id='${ga.id}' AND slug='${ga.slug}' AND created_by='${a.user}' AND deleted_at IS NULL FOR UPDATE;\n  IF NOT FOUND THEN RAISE EXCEPTION 'Wrong synthetic group A'; END IF;\n  PERFORM 1 FROM public.groups WHERE id='${gb.id}' AND slug='${gb.slug}' AND created_by='${b.user}' AND deleted_at IS NULL FOR UPDATE;\n  IF NOT FOUND THEN RAISE EXCEPTION 'Wrong synthetic group B'; END IF;\n  IF (SELECT count(*) FROM public.group_members WHERE group_id='${ga.id}')<>1 OR NOT EXISTS(SELECT 1 FROM public.group_members WHERE group_id='${ga.id}' AND player_id='${a.player}' AND role='owner' AND status='active') THEN RAISE EXCEPTION 'Unexpected group A roster'; END IF;\n  IF (SELECT count(*) FROM public.group_members WHERE group_id='${gb.id}')<>1 OR NOT EXISTS(SELECT 1 FROM public.group_members WHERE group_id='${gb.id}' AND player_id='${b.player}' AND role='owner' AND status='active') THEN RAISE EXCEPTION 'Unexpected group B roster'; END IF;\n  IF NOT EXISTS(SELECT 1 FROM public.players WHERE id='${c.player}' AND user_id='${c.user}' AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Wrong technical C'; END IF;\n  INSERT INTO public.group_members(group_id,player_id,role,status) VALUES('${ga.id}','${c.player}','player','active');\nEND $audit$;\nCOMMIT;\n`;
}
export { snapshotFingerprint };
