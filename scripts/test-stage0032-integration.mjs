// Real JWT/SSR/Data API audit. Creates only dedicated synthetic fixtures.
// NEVER deletes remote rows or edits profile fields. Leaves a private manifest
// for owner-reviewed cleanup. Do not use real player accounts.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { describeAuthFailure } from "./stage0032-auth-diagnostics.mjs";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
  "TEST_ACCOUNTS_ARE_SYNTHETIC",
  "TEST_ALLOW_CREATE_AUDIT_FIXTURES",
];
if (process.argv.includes("--check")) {
  console.log(
    JSON.stringify({
      configuration: Object.fromEntries(
        required.map((k) => [k, Boolean(process.env[k])]),
      ),
      cleanup: "none; fixtures are retained",
    }),
  );
  process.exit(0);
}
for (const key of required)
  assert(process.env[key], `Missing variable: ${key}`);
assert.equal(process.env.TEST_ACCOUNTS_ARE_SYNTHETIC, "1");
assert.equal(process.env.TEST_ALLOW_CREATE_AUDIT_FIXTURES, "1");
assert.equal(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "https://hpbvtqvbtyioqjyelrpb.supabase.co",
);
assert(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith(
    "sb_publishable_",
  ),
);
assert.equal(process.env.NEXT_PUBLIC_SITE_URL, "https://www.borafute.com.br");

const run = randomUUID();
const slugA = `audit-0032-a-${run}`;
const slugB = `audit-0032-b-${run}`;
const state = {
  run,
  slugs: [slugA, slugB],
  groups: [],
  players: [],
  requests: [],
  result: "started",
  phase: "authentication",
  authentication: {},
};
mkdirSync("work", { recursive: true });
const manifest = `work/stage0032-${run}.json`;
function save() {
  writeFileSync(manifest, JSON.stringify(state, null, 2), { mode: 0o600 });
}
save();
function session() {
  const jar = new Map();
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: { secure: true },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
      },
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (values) =>
          values.forEach(({ name, value, options }) => {
            if (options.maxAge === 0) jar.delete(name);
            else jar.set(name, value);
          }),
      },
    },
  );
  return { db, jar };
}
const a = session(),
  b = session(),
  anonymous = session();
function ok(result, label) {
  assert(!result.error, `${label} failed; provider details suppressed`);
  return result.data;
}
function request() {
  const id = randomUUID();
  state.requests.push(id);
  save();
  return id;
}
async function addGroup(s, slug, req) {
  const id = ok(
    await s.db.rpc("create_group_once", {
      p_request_id: req,
      p_name: `Auditoria 003.2 ${run.slice(0, 8)}`,
      p_slug: slug,
      p_description:
        "Synthetic audit fixture; owner approval required for cleanup",
      p_timezone: "America/Sao_Paulo",
    }),
    "create group",
  );
  if (!state.groups.includes(id)) {
    state.groups.push(id);
    save();
  }
  return id;
}
async function addGuest(s, groupId, req) {
  const id = ok(
    await s.db.rpc("add_guest_once", {
      p_request_id: req,
      p_group_id: groupId,
      p_name: "Convidado fictício auditoria 003.2",
      p_nickname: "",
      p_position: "defender",
    }),
    "add guest",
  );
  if (!state.players.includes(id)) {
    state.players.push(id);
    save();
  }
  return id;
}
async function members(s, id) {
  return ok(
    await s.db
      .from("group_members")
      .select("id,player_id,role,status")
      .eq("group_id", id),
    "read members",
  );
}
async function site(s, path) {
  const cookie = [...s.jar]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  // Real SSR cookies from password authentication, no fabricated JWT/claims.
  return fetch(process.env.NEXT_PUBLIC_SITE_URL + path, {
    headers: { Cookie: cookie },
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
}
try {
  for (const [s, label] of [
    [a, "A"],
    [b, "B"],
  ]) {
    state.authentication = { account: label, step: "signInWithPassword" };
    save();
    let signIn;
    try {
      signIn = await s.db.auth.signInWithPassword({
        email: process.env[`TEST_USER_${label}_EMAIL`],
        password: process.env[`TEST_USER_${label}_PASSWORD`],
      });
    } catch (error) {
      state.authentication.error = describeAuthFailure(error, [
        process.env[`TEST_USER_${label}_EMAIL`],
        process.env[`TEST_USER_${label}_PASSWORD`],
      ]);
      save();
      throw new Error("Authentication request failed");
    }
    if (signIn.error) {
      state.authentication.error = describeAuthFailure(signIn.error, [
        process.env[`TEST_USER_${label}_EMAIL`],
        process.env[`TEST_USER_${label}_PASSWORD`],
      ]);
      save();
      throw new Error("Supabase rejected authentication");
    }
  }
  async function getAuthUser(s, label) {
    state.authentication = { account: label, step: "getUser" };
    save();
    let result;
    try {
      result = await s.db.auth.getUser();
    } catch (error) {
      state.authentication.error = describeAuthFailure(error, [
        process.env[`TEST_USER_${label}_EMAIL`],
        process.env[`TEST_USER_${label}_PASSWORD`],
      ]);
      save();
      throw new Error("Authentication user lookup failed");
    }
    if (result.error) {
      state.authentication.error = describeAuthFailure(result.error, [
        process.env[`TEST_USER_${label}_EMAIL`],
        process.env[`TEST_USER_${label}_PASSWORD`],
      ]);
      save();
      throw new Error("Supabase rejected authentication user lookup");
    }
    return result.data.user;
  }
  const userA = await getAuthUser(a, "A");
  const userB = await getAuthUser(b, "B");
  state.authentication = { account: "A/B", step: "distinctConfirmedAccounts" };
  save();
  assert(
    userA && userB && userA.id !== userB.id,
    "Use two distinct confirmed synthetic accounts",
  );
  state.authentication = {};
  state.phase = "identity";
  save();
  // Idempotent onboarding does not overwrite preexisting names/profiles.
  const playerA = ok(
    await a.db.rpc("ensure_my_identity", {
      p_display_name: "Auditoria fictícia A",
    }),
    "identity A",
  );
  const playerB = ok(
    await b.db.rpc("ensure_my_identity", {
      p_display_name: "Auditoria fictícia B",
    }),
    "identity B",
  );
  state.phase = "fixture_creation";
  save();
  const reqA = request();
  const reqB = request();
  const [groupA, sameA, groupB] = await Promise.all([
    addGroup(a, slugA, reqA),
    addGroup(a, slugA, reqA),
    addGroup(b, slugB, reqB),
  ]);
  assert.equal(groupA, sameA, "Concurrent retry duplicated group");
  const guestRequest = request();
  const [guestA, sameGuest] = await Promise.all([
    addGuest(a, groupA, guestRequest),
    addGuest(a, groupA, guestRequest),
  ]);
  assert.equal(guestA, sameGuest, "Concurrent retry duplicated guest");
  await addGuest(b, groupB, request());
  state.phase = "tenant_isolation";
  save();
  for (const [s, foreign] of [
    [a, groupB],
    [b, groupA],
  ]) {
    assert.equal(
      ok(
        await s.db.from("groups").select("id").eq("id", foreign),
        "cross-group query",
      ).length,
      0,
    );
    assert.equal(
      ok(
        await s.db.from("group_members").select("id").eq("group_id", foreign),
        "cross-members query",
      ).length,
      0,
    );
    assert(
      (
        await s.db.rpc("add_guest_once", {
          p_request_id: request(),
          p_group_id: foreign,
          p_name: "Unauthorized synthetic attempt",
          p_nickname: "",
          p_position: "",
        })
      ).error,
      "Foreign guest RPC unexpectedly succeeded; inspect fixture manifest",
    );
  }
  state.phase = "ownership_and_guest";
  save();
  const am = await members(a, groupA);
  const bm = await members(b, groupB);
  const ag = am.find((m) => m.player_id === guestA);
  assert(ag && ag.role === "guest" && ag.status === "active");
  assert.equal(
    am.filter((m) => m.role === "owner" && m.status === "active").length,
    1,
  );
  assert.equal(
    bm.filter((m) => m.role === "owner" && m.status === "active").length,
    1,
  );
  assert(am.some((m) => m.player_id === playerA && m.role === "owner"));
  assert(bm.some((m) => m.player_id === playerB && m.role === "owner"));
  const guest = ok(
    await a.db
      .from("players")
      .select("user_id,origin_group_id")
      .eq("id", guestA)
      .single(),
    "guest identity",
  );
  assert.equal(guest.user_id, null);
  assert.equal(guest.origin_group_id, groupA);
  assert(
    (
      await b.db.rpc("set_member_role", {
        p_group_id: groupA,
        p_member_id: ag.id,
        p_role: "owner",
      })
    ).error,
    "Foreign role RPC succeeded",
  );
  assert(
    (
      await a.db.rpc("set_member_role", {
        p_group_id: groupA,
        p_member_id: ag.id,
        p_role: "owner",
      })
    ).error,
    "Generic role RPC promoted guest to owner",
  );
  state.phase = "unauthorized_writes";
  save();
  const forged = await b.db
    .from("group_members")
    .update({ role: "owner" })
    .eq("id", ag.id)
    .select("id");
  assert(
    forged.error || forged.data.length === 0,
    "Foreign direct role update succeeded",
  );
  assert(
    (
      await anonymous.db.rpc("ensure_my_identity", {
        p_display_name: "Anonymous attempt",
      })
    ).error,
    "Anonymous RPC succeeded",
  );
  assert.equal(
    (await members(a, groupA)).find((m) => m.id === ag.id).role,
    "guest",
  );
  state.phase = "ssr";
  save();
  for (const [s, user, ownSlug, foreignSlug] of [
    [a, userA, slugA, slugB],
    [b, userB, slugB, slugA],
  ]) {
    const me = await site(s, "/api/me");
    assert.equal(
      me.status,
      200,
      "SSR identity failed; inspect deployment protection/network",
    );
    assert.equal((await me.json()).id, user.id);
    assert.equal(
      (await site(s, `/groups/${ownSlug}`)).status,
      200,
      "Own SSR group unavailable",
    );
    assert.equal(
      (await site(s, `/groups/${foreignSlug}`)).status,
      404,
      "Foreign SSR group was not hidden",
    );
  }
  state.result =
    "passed JWT/Data API/RPC/SSR checks; browser journey remains separate";
  save();
  console.log(
    JSON.stringify({
      result: "PASS",
      run,
      manifest,
      cleanup: "none; fixtures retained for review",
    }),
  );
} catch {
  state.result =
    "failed; inspect only this run's fixtures and categories, never print credentials";
  save();
  console.error(
    JSON.stringify({
      result: "FAIL",
      phase: state.phase,
      ...(state.phase === "authentication" && state.authentication.account
        ? { authentication: state.authentication }
        : {}),
      run,
      manifest,
      cleanup: "none; fixtures retained",
    }),
  );
  process.exitCode = 1;
} finally {
  // Dedicated audit sessions only. No row deletion or profile restoration.
  await Promise.allSettled([
    a.db.auth.signOut({ scope: "local" }),
    b.db.auth.signOut({ scope: "local" }),
  ]);
}
