// REAL Auth/Data API tests. Dedicated confirmed test accounts only.
// A privileged database connection is used exclusively for preflight/cleanup,
// never to impersonate users in the API assertions. No credential is logged.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const ref = "hpbvtqvbtyioqjyelrpb";
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
  "TEST_DATABASE_URL",
  "TEST_ACCOUNTS_ARE_SYNTHETIC",
];
if (process.argv.includes("--check")) {
  console.log(
    JSON.stringify({
      configuration: Object.fromEntries(
        required.map((k) => [k, Boolean(process.env[k])]),
      ),
      psql: spawnSync("psql", ["--version"], { stdio: "ignore" }).status === 0,
    }),
  );
  process.exit(0);
}
for (const key of required)
  assert(process.env[key], `Missing environment variable: ${key}`);
assert.equal(
  process.env.TEST_ACCOUNTS_ARE_SYNTHETIC,
  "1",
  "Use dedicated synthetic accounts only",
);
assert.equal(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  `https://${ref}.supabase.co`,
);
assert(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith(
    "sb_publishable_",
  ),
);
let database;
try {
  database = new URL(process.env.TEST_DATABASE_URL);
} catch {
  throw new Error("Invalid cleanup database URI; value suppressed.");
}
assert(["postgres:", "postgresql:"].includes(database.protocol));
assert(
  database.hostname === `db.${ref}.supabase.co` ||
    (database.hostname.endsWith(".pooler.supabase.com") &&
      decodeURIComponent(database.username) === `postgres.${ref}`),
  "Cleanup database must match development project",
);
assert.equal(
  database.searchParams.get("sslmode"),
  "verify-full",
  "Use verified TLS for cleanup",
);
assert.equal(
  spawnSync("psql", ["--version"], { stdio: "ignore" }).status,
  0,
  "Install psql before running",
);
function sql(query) {
  const result = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1"], {
    input: query,
    encoding: "utf8",
    env: {
      ...process.env,
      PGDATABASE: process.env.TEST_DATABASE_URL,
      PGCONNECT_TIMEOUT: "15",
    },
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0)
    throw Error(
      "Privileged preflight/cleanup failed; output suppressed to protect credentials.",
    );
}
sql("select 1;"); // Fail before creating anything if cleanup is unavailable.
const client = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
const a = client(),
  b = client(),
  anonymous = client();
const run = randomUUID();
const slug = `http-test-${run}`;
const state = { run, slug, accounts: [], groupId: null, playerIds: [] };
const q = (value) =>
  value === null || value === undefined
    ? "null"
    : "'" + String(value).replaceAll("'", "''") + "'";
function ok(result, label) {
  if (result.error)
    throw Error(`${label} failed (provider details suppressed).`);
  return result.data;
}
let snapshots = [];
let touched = false;
try {
  const users = [];
  for (const [db, letter] of [
    [a, "A"],
    [b, "B"],
  ]) {
    const data = ok(
      await db.auth.signInWithPassword({
        email: process.env[`TEST_USER_${letter}_EMAIL`],
        password: process.env[`TEST_USER_${letter}_PASSWORD`],
      }),
      "Real Auth login",
    );
    assert(
      data.user?.email_confirmed_at,
      "Confirm test accounts before running",
    );
    const verified = ok(await db.auth.getUser(), "Real JWT validation");
    users.push(verified.user.id);
  }
  assert.notEqual(users[0], users[1]);
  state.accounts = users;
  for (const [index, db] of [a, b].entries()) {
    const profile = ok(
      await db
        .from("profiles")
        .select("display_name")
        .eq("id", users[index])
        .maybeSingle(),
      "Profile snapshot",
    );
    const player = ok(
      await db
        .from("players")
        .select("id,name,nickname,preferred_position")
        .eq("user_id", users[index])
        .maybeSingle(),
      "Player snapshot",
    );
    snapshots.push({ user: users[index], profile, player });
  }
  // Persist before any mutation, so a terminated run has a bounded recovery manifest.
  mkdirSync("work", { recursive: true });
  writeFileSync(
    `work/integration-${run}.json`,
    JSON.stringify({ ...state, snapshots }, null, 2),
    { mode: 0o600 },
  );
  touched = true;
  for (const [index, db] of [a, b].entries()) {
    const first = ok(
      await db.rpc("ensure_my_identity", {
        p_display_name: `Synthetic HTTP ${index}`,
      }),
      "Prepare identity",
    );
    state.playerIds[index] = first;
    writeFileSync(
      `work/integration-${run}.json`,
      JSON.stringify({ ...state, snapshots }, null, 2),
      { mode: 0o600 },
    );
    const second = ok(
      await db.rpc("ensure_my_identity", {
        p_display_name: `Synthetic HTTP ${index}`,
      }),
      "Retry identity",
    );
    assert.equal(first, second);
  }
  const request = randomUUID();
  const groupArgs = {
    p_request_id: request,
    p_name: "Synthetic HTTP group",
    p_slug: slug,
    p_description: "Temporary integration fixture",
    p_timezone: "America/Sao_Paulo",
  };
  state.groupId = ok(
    await a.rpc("create_group_once", groupArgs),
    "Create group",
  );
  assert.equal(
    ok(await a.rpc("create_group_once", groupArgs), "Retry group"),
    state.groupId,
  );
  const duplicate = await a.rpc("create_group_once", {
    ...groupArgs,
    p_request_id: randomUUID(),
  });
  assert.equal(duplicate.error?.code, "23505");
  const members = ok(
    await a
      .from("group_members")
      .select("role,status")
      .eq("group_id", state.groupId),
    "Initial owner",
  );
  assert.equal(members.length, 1);
  assert.equal(members[0].role, "owner");
  assert.equal(members[0].status, "active");
  const hidden = ok(
    await b.from("groups").select("id").eq("id", state.groupId),
    "Tenant isolation",
  );
  assert.equal(hidden.length, 0);
  const privateProfile = ok(
    await b.from("profiles").select("id").eq("id", users[0]),
    "Profile isolation",
  );
  assert.equal(privateProfile.length, 0);
  const guestArgs = {
    p_request_id: randomUUID(),
    p_group_id: state.groupId,
    p_name: "Synthetic HTTP guest",
    p_nickname: "",
    p_position: "defender",
  };
  const guest = ok(await a.rpc("add_guest_once", guestArgs), "Add guest");
  assert.equal(
    ok(await a.rpc("add_guest_once", guestArgs), "Retry guest"),
    guest,
  );
  assert.equal(
    (
      await b.rpc("add_guest_once", {
        ...guestArgs,
        p_request_id: randomUUID(),
      })
    ).error?.code,
    "42501",
  );
  const savedGuest = ok(
    await a
      .from("players")
      .select("id,user_id,origin_group_id,preferred_position")
      .eq("id", guest)
      .single(),
    "Guest persistence",
  );
  assert.equal(savedGuest.user_id, null);
  assert.equal(savedGuest.origin_group_id, state.groupId);
  assert.equal(savedGuest.preferred_position, "defender");
  assert.equal(
    ok(
      await a.from("group_members").select("id").eq("group_id", state.groupId),
      "Guest membership",
    ).length,
    2,
  );
  const own = ok(
    await a.rpc("save_my_identity", {
      p_display_name: "Synthetic HTTP updated",
      p_name: "Synthetic HTTP player",
      p_nickname: "Test",
      p_position: "forward",
    }),
    "Update own profile",
  );
  void own;
  assert.equal(
    ok(
      await a
        .from("profiles")
        .select("display_name")
        .eq("id", users[0])
        .single(),
      "Own profile read",
    ).display_name,
    "Synthetic HTTP updated",
  );
  assert.equal(
    (await anonymous.from("groups").select("id").eq("id", state.groupId)).error
      ?.code,
    "42501",
    "Anonymous access must be denied by authorization",
  );
  await a.auth.signOut({ scope: "local" });
  assert.equal((await a.auth.getUser()).data.user, null);
  console.log(
    "PASS: real Auth/JWT and Data API: identity, group owner, idempotency, guests, profile, tenant isolation, anonymous denial and logout.",
  );
} catch {
  process.exitCode = 1;
  console.error(
    "FAIL: integration scenario did not complete. No provider error, email, password or JWT was logged.",
  );
} finally {
  if (touched) {
    try {
      const [sa] = snapshots;
      // Only this random slug owned by test account A is eligible for cleanup.
      const restore = snapshots
        .map((s, index) =>
          s.player
            ? `update public.players set name=${q(s.player.name)},nickname=${q(s.player.nickname)},preferred_position=${q(s.player.preferred_position)} where id=${q(s.player.id)}::uuid and user_id=${q(s.user)}::uuid;`
            : state.playerIds[index]
              ? `delete from public.players where id=${q(state.playerIds[index])}::uuid and user_id=${q(s.user)}::uuid and origin_group_id is null and not exists(select 1 from public.group_members m where m.player_id=public.players.id);`
              : "",
        )
        .join("\n");
      const profiles = snapshots
        .map((s) =>
          s.profile
            ? `update public.profiles set display_name=${q(s.profile.display_name)} where id=${q(s.user)}::uuid;`
            : state.playerIds[snapshots.indexOf(s)]
              ? `delete from public.profiles where id=${q(s.user)}::uuid;`
              : "",
        )
        .join("\n");
      sql(`begin;
     do $$ declare ids uuid[]; begin
       select array_agg(id) into ids from public.groups where slug=${q(slug)} and created_by=${q(sa.user)}::uuid;
       if exists(select 1 from public.group_members m join public.players p on p.id=m.player_id where m.group_id=any(ids) and (p.user_id=${q(sa.user)}::uuid or (p.user_id is null and p.origin_group_id=any(ids) and p.name='Synthetic HTTP guest')) is not true) then raise exception 'Unexpected membership; manual review required'; end if;
       delete from private.mutation_receipts where group_id=any(ids) and actor_user_id=${q(sa.user)}::uuid;
       delete from private.membership_events where member_id in(select id from public.group_members where group_id=any(ids));
       delete from public.group_members where group_id=any(ids);
       delete from public.players where origin_group_id=any(ids) and user_id is null and created_by=${q(sa.user)}::uuid and name='Synthetic HTTP guest';
       delete from public.groups where id=any(ids) and slug=${q(slug)};
     end $$;
     ${restore}
     ${profiles}
     set constraints all immediate;
     commit;`);
      console.log(
        "Cleanup completed: only tagged test group/guests/receipts removed; prior profile fields restored. Auth accounts preserved.",
      );
      if (
        snapshots.some(
          (snapshot, index) => !snapshot.player && !state.playerIds[index],
        )
      ) {
        process.exitCode = 1;
        console.error(
          `Onboarding outcome not confirmed; review work/integration-${run}.json before declaring cleanup complete.`,
        );
      }
    } catch {
      process.exitCode = 1;
      console.error(
        `Cleanup not confirmed. Preserve work/integration-${run}.json for reviewed recovery; do not run broad deletion.`,
      );
    }
  }
  await Promise.allSettled([
    a.auth.signOut({ scope: "local" }),
    b.auth.signOut({ scope: "local" }),
  ]);
}
