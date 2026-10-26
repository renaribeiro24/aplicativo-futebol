// Dedicated C audit: no insertion of membership, no cleanup, no privileged client.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  MEMBER_C_FIXTURE as f,
  assertCIdentity,
  assertMemberFixture,
  snapshotFingerprint,
  classifyDenied,
} from "./stage0032-member-c-checks.mjs";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_C_EMAIL",
  "TEST_USER_C_PASSWORD",
  "TEST_ACCOUNTS_ARE_SYNTHETIC",
];
if (process.argv.includes("--check")) {
  console.log(
    JSON.stringify({
      configuration: Object.fromEntries(
        required.map((k) => [k, Boolean(process.env[k])]),
      ),
      insertsMembership: false,
      cleanup: "none",
    }),
  );
  process.exit(0);
}
// No credential values in assertion output, including malformed configuration.
assert(
  required.every((k) => Boolean(process.env[k])),
  "Required configuration missing; run --check",
);
assert(
  process.env.NEXT_PUBLIC_SUPABASE_URL ===
    "https://hpbvtqvbtyioqjyelrpb.supabase.co",
  "Only the authorized development project is allowed",
);
assert(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith(
    "sb_publishable_",
  ),
  "Only a publishable key is allowed",
);
assert(
  process.env.TEST_ACCOUNTS_ARE_SYNTHETIC === "1",
  "Dedicated synthetic accounts required",
);
const run = randomUUID();
const manifest = `work/stage0032-member-c-${run}.json`;
const state = {
  run,
  result: "started",
  phase: "authentication",
  fixtures: f,
  checks: [],
  requests: [],
  unexpectedFixtureIds: [],
  integrity: { checked: false, unchanged: null },
};
mkdirSync("work", { recursive: true });
const save = () =>
  writeFileSync(manifest, JSON.stringify(state, null, 2), { mode: 0o600 });
save();
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
    },
  },
);
function record(scenario, detail) {
  state.checks.push({ scenario, ...detail });
  save();
}
function data(result) {
  assert(
    !result.error && result.data !== null,
    "Read failed; provider details suppressed",
  );
  return result.data;
}
let before;
async function snapshot() {
  const [profile, group, members] = await Promise.all([
    db
      .from("profiles")
      .select("id,display_name,avatar_url,created_at,updated_at")
      .eq("id", f.user)
      .single(),
    db
      .from("groups")
      .select(
        "id,name,slug,description,timezone,created_by,deleted_at,updated_at",
      )
      .eq("id", f.groupA)
      .single(),
    db
      .from("group_members")
      .select(
        "id,group_id,player_id,role,status,joined_at,created_at,updated_at",
      )
      .eq("group_id", f.groupA)
      .order("id"),
  ]);
  const ms = data(members);
  assert(
    ms.length === 3,
    "Expected only the original owner, original guest and C in this fixture",
  );
  const players = data(
    await db
      .from("players")
      .select(
        "id,user_id,origin_group_id,name,nickname,preferred_position,deleted_at,updated_at",
      )
      .in(
        "id",
        ms.map((m) => m.player_id),
      )
      .order("id"),
  );
  const result = {
    profile: data(profile),
    group: data(group),
    members: ms,
    players,
  };
  assertMemberFixture(result);
  assert(
    players.length === 3 &&
      players.every(
        (p) =>
          p.user_id === f.user ||
          p.user_id === result.group.created_by ||
          (p.user_id === null && p.origin_group_id === f.groupA),
      ),
    "Fixture includes an unexpected identity",
  );
  return result;
}
async function integrity() {
  const after = await snapshot();
  const unchanged = snapshotFingerprint(before) === snapshotFingerprint(after);
  state.integrity = {
    scope: "profile_and_group_A",
    checked: true,
    unchanged,
    originalOwnerUnique: true,
    cPlayerActive: true,
  };
  save();
  assert(
    unchanged,
    "Fixture changed; preserve evidence, do not clean or repeat",
  );
}
async function denied(scenario, query, allowEmpty = false) {
  state.currentScenario = scenario;
  state.integrity = { checked: false, unchanged: null };
  save();
  const result = await query;
  const detail = classifyDenied(result, allowEmpty);
  // Only unexpected generated UUIDs, never error messages or response objects.
  if (
    !detail.passed &&
    typeof result.data === "string" &&
    /^[a-f0-9-]{36}$/.test(result.data)
  )
    state.unexpectedFixtureIds.push(result.data);
  record(scenario, detail);
  // Verify effects after every attempt, even if its response was unexpected.
  await integrity();
  assert(
    detail.passed,
    "Forbidden operation did not produce an expected authorization denial",
  );
}
function request() {
  const id = randomUUID();
  state.requests.push(id);
  save();
  return id;
}
try {
  state.currentScenario = "signInWithPassword";
  save();
  const login = await db.auth.signInWithPassword({
    email: process.env.TEST_USER_C_EMAIL,
    password: process.env.TEST_USER_C_PASSWORD,
  });
  if (login.error) {
    state.authentication = {
      category: "authentication_rejected",
      status: Number.isInteger(login.error.status) ? login.error.status : null,
      code: [
        "invalid_credentials",
        "email_not_confirmed",
        "over_request_rate_limit",
      ].includes(login.error.code)
        ? login.error.code
        : "other",
    };
    save();
  }
  assert(
    !login.error && login.data.session?.access_token,
    "Authentication rejected; no provider details logged",
  );
  state.currentScenario = "getUser";
  save();
  const user = data(await db.auth.getUser()).user;
  assertCIdentity(user);
  record("confirmed_C_real_JWT", {
    passed: true,
    category: "provider_validated_identity",
  });
  state.phase = "fixture_preflight";
  save();
  state.currentScenario = "fixture_snapshot";
  save();
  before = await snapshot();
  record("own_profile_group_members_players", {
    passed: true,
    category: "authorized_read",
  });
  state.phase = "cross_tenant_reads";
  save();
  for (const [table, column] of [
    ["groups", "id"],
    ["group_members", "group_id"],
    ["players", "origin_group_id"],
  ]) {
    state.currentScenario = `foreign_${table}`;
    save();
    const result = await db.from(table).select("id").eq(column, f.groupB);
    const rows = data(result);
    const passed = Array.isArray(rows) && rows.length === 0;
    record(`foreign_${table}`, {
      passed,
      status: result.status,
      category: passed ? "hidden_or_not_found" : "unexpected_visible_rows",
    });
    assert(passed, "Foreign synthetic tenant data visible");
  }
  const owner = before.members.find(
    (m) => m.role === "owner" && m.status === "active",
  );
  state.phase = "forbidden_operations";
  save();
  for (const role of ["admin", "owner"]) {
    await denied(
      `direct_self_${role}`,
      db
        .from("group_members")
        .update({ role })
        .eq("id", f.member)
        .eq("group_id", f.groupA)
        .select("id"),
      true,
    );
    await denied(
      `rpc_self_${role}`,
      db.rpc("set_member_role", {
        p_group_id: f.groupA,
        p_member_id: f.member,
        p_role: role,
      }),
    );
  }
  await denied(
    "rpc_change_other_role",
    db.rpc("set_member_role", {
      p_group_id: f.groupA,
      p_member_id: owner.id,
      p_role: "player",
    }),
  );
  await denied(
    "direct_deactivate_owner",
    db
      .from("group_members")
      .update({ status: "left" })
      .eq("id", owner.id)
      .eq("group_id", f.groupA)
      .select("id"),
    true,
  );
  await denied(
    "rpc_remove_owner",
    db.rpc("set_member_status", {
      p_group_id: f.groupA,
      p_member_id: owner.id,
      p_status: "left",
    }),
  );
  await denied(
    "rpc_transfer_ownership",
    db.rpc("transfer_ownership", {
      p_group_id: f.groupA,
      p_member_id: f.member,
    }),
  );
  for (const [label, group] of [
    ["own", f.groupA],
    ["foreign", f.groupB],
  ]) {
    await denied(
      `${label}_group_admin_update`,
      db
        .from("groups")
        .update({ description: `UNAUTHORIZED SYNTHETIC ATTEMPT ${run}` })
        .eq("id", group)
        .select("id"),
      true,
    );
    await denied(
      `${label}_add_guest`,
      db.rpc("add_guest_once", {
        p_request_id: request(),
        p_group_id: group,
        p_name: "Unauthorized C audit attempt",
        p_nickname: "",
        p_position: "defender",
      }),
    );
    await denied(
      `${label}_create_invitation`,
      db.rpc("create_invitation", {
        p_group_id: group,
        p_token_hash: randomBytes(32).toString("hex"),
        p_role: "player",
        p_expires_at: new Date(Date.now() + 3600000).toISOString(),
        p_max_uses: 1,
      }),
    );
  }
  state.phase = "integrity";
  state.currentScenario = "final_owner_and_C_unchanged";
  save();
  await integrity();
  record("final_owner_and_C_unchanged", {
    passed: true,
    category: "integrity",
  });
  state.result = "PASS";
  save();
} catch (error) {
  state.result = "FAIL";
  state.failure = {
    scenario: state.currentScenario ?? state.phase,
    category:
      error?.name === "TimeoutError" || error?.name === "AbortError"
        ? "timeout"
        : error?.name === "AssertionError"
          ? "assertion_failed"
          : "connectivity_or_executor",
  };
  if (state.checks.at(-1)?.passed !== false)
    record(state.failure.scenario, {
      passed: false,
      category: state.failure.category,
    });
  save();
  // Capture integrity on transport/SQL errors too, without another mutation.
  if (before && !state.integrity.checked) {
    try {
      await integrity();
    } catch {
      state.integrity = { checked: false, unchanged: null };
      save();
    }
  }
  process.exitCode = 1;
} finally {
  // Revoke only this dedicated audit session; never alter rows or user credentials.
  try {
    await db.auth.signOut({ scope: "local" });
  } catch {
    /* do not print SDK errors */
  }
}
console.log(
  JSON.stringify({
    result: state.result,
    phase: state.phase,
    failure: state.failure,
    authentication: state.authentication,
    summary: {
      passed: state.checks.filter((c) => c.passed).length,
      failed: state.checks.filter((c) => !c.passed).length,
    },
    run,
    manifest,
    checks: state.checks,
    integrity: state.integrity,
    cleanup: "none; preserve fixtures; do not repeat automatically",
  }),
);
