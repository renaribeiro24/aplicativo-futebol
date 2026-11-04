// Real Auth JWT + Data API only. No service key, migrations, cleanup, retries or existing-link edits.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  lstatSync,
  renameSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { describeAuthFailure } from "./stage0032-auth-diagnostics.mjs";
import {
  PROJECT_URL,
  assertBranch,
  configuration,
  assertConfiguration,
  assertIdentities,
  uuid,
  validateManifest,
  membershipSeed,
  verifyDenied,
} from "./stage0042-http-guards.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const args = process.argv.slice(2),
  modes = ["--check", "--preflight", "--prepare", "--run"].filter((x) =>
    args.includes(x),
  );
assert(
  modes.length === 1 && args.length === (modes[0] === "--run" ? 2 : 1),
  "Use --check | --preflight | --prepare | --run RUN_UUID",
);
const mode = modes[0],
  env = process.env,
  key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (mode === "--check") {
  console.log(
    JSON.stringify({
      configuration: configuration(env),
      syntheticConfirmation:
        "owner declaration required; confirmed Auth identities checked before any write",
      phases: [
        "--prepare",
        "review and execute generated membership seed",
        "--run RUN_UUID",
      ],
      cleanup: "none",
    }),
  );
  process.exit(
    Object.values(configuration(env).present).every(Boolean) &&
      configuration(env).targetValid &&
      configuration(env).publishableKey &&
      configuration(env).syntheticDeclaration &&
      configuration(env).creationAuthorized
      ? 0
      : 2,
  );
}
let state,
  manifest,
  current = "preflight",
  actors = [],
  anonymous;
const tables = [
  "group_schedules",
  "group_pricing_policies",
  "member_billing_terms",
];
const codeOf = (r) =>
  typeof r?.error?.code === "string" &&
  /^[A-Za-z0-9_]{1,30}$/.test(r.error.code)
    ? r.error.code
    : null;
const save = () => {
  if (manifest) {
    const temporary = `${manifest}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify(state, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    renameSync(temporary, manifest);
    chmodSync(manifest, 0o600);
  }
};
const uniquePassed = () =>
  new Set((state?.checks ?? []).filter((c) => c.passed).map((c) => c.label))
    .size;
const codeVersion = () => ({
  runnerSha256: createHash("sha256")
    .update(readFileSync(fileURLToPath(import.meta.url)))
    .digest("hex"),
  guardsSha256: createHash("sha256")
    .update(
      readFileSync(new URL("./stage0042-http-guards.mjs", import.meta.url)),
    )
    .digest("hex"),
  dirty:
    execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    }).trim().length > 0,
});
const check = (condition, label, detail = {}) => {
  current = label;
  assert(condition, "Checkpoint failed; private provider details suppressed");
  state.checks.push({
    label,
    passed: true,
    checkedAt: new Date().toISOString(),
    ...detail,
  });
  save();
};
function client() {
  return createClient(PROJECT_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        const url = new URL(
          typeof input === "string" || input instanceof URL ? input : input.url,
        );
        assert(url.origin === PROJECT_URL, "Unexpected HTTP destination");
        const response = await fetch(input, {
          ...init,
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        });
        let code = null;
        if (!response.ok) {
          try {
            const body = await response.clone().json();
            const raw = body.code ?? body.error_code;
            code =
              typeof raw === "string" &&
              /^(?:[0-9A-Z]{5}|PGRST[0-9]{3}|invalid_credentials|email_not_confirmed)$/.test(
                raw,
              )
                ? raw
                : "other";
          } catch {
            /* Do not log response bodies. */
          }
        }
        const observation = {
          method: init?.method ?? "GET",
          route: url.pathname,
          status: response.status,
          code,
        };
        if (state) {
          state.lastHttp = observation;
          const active = state.attempts.at(-1);
          if (active?.label === current && observation.method !== "GET") {
            active.response = observation;
            save();
          }
        }
        return response;
      },
    },
  });
}
async function connectivity() {
  const out = [];
  for (const [endpoint, path] of [
    ["auth", "/auth/v1/health"],
    ["data_api", "/rest/v1/"],
  ]) {
    try {
      const r = await fetch(PROJECT_URL + path, {
        headers: key?.startsWith("sb_publishable_") ? { apikey: key } : {},
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      out.push({
        endpoint,
        status: r.status,
        category: r.ok
          ? "reachable"
          : r.status === 401
            ? "api_key_or_auth_required"
            : r.status === 403
              ? "http_forbidden"
              : "unexpected_http",
      });
      await r.body?.cancel();
    } catch (error) {
      const text = String(error?.message) + String(error?.cause?.message);
      out.push({
        endpoint,
        status: null,
        category: /proxy|CONNECT|tunnel/i.test(text)
          ? "proxy"
          : /Timeout|Abort/i.test(error?.name ?? "")
            ? "timeout"
            : "network_or_tls",
      });
    }
  }
  return out;
}
function begin(run, metadata) {
  uuid(run);
  mkdirSync("work", { recursive: true });
  manifest = `work/stage0042-http-${run}.json`;
  state = {
    version: 1,
    run,
    project: PROJECT_URL,
    preparedAt: new Date().toISOString(),
    preparedWith: codeVersion(),
    result: "STARTED",
    phase: "authentication",
    groups: [],
    identities: [],
    rows: [],
    venues: [],
    attempts: [],
    checks: [],
    limitations: [
      "No public transactional successor RPC: two REST calls are not atomic",
      "Expired-history edits remain covered by SQL; no privileged backdating in this runner",
    ],
    cleanup: "none; retain fixtures and private manifests",
    ...metadata,
  };
  writeFileSync(manifest, JSON.stringify(state, null, 2) + "\n", {
    mode: 0o600,
    flag: "wx",
  });
}
async function authenticate() {
  for (const label of ["A", "B", "C"]) {
    current = `authenticate_${label}`;
    const db = client();
    actors.push({ db, label });
    const login = await db.auth.signInWithPassword({
      email: env[`TEST_USER_${label}_EMAIL`],
      password: env[`TEST_USER_${label}_PASSWORD`],
    });
    if (login.error) {
      state.authenticationFailure = {
        account: label,
        ...describeAuthFailure(login.error, [
          ...["A", "B", "C"].flatMap((x) => [
            env[`TEST_USER_${x}_EMAIL`],
            env[`TEST_USER_${x}_PASSWORD`],
          ]),
          key,
        ]),
      };
      save();
      throw Error("Auth rejected technical account");
    }
    const token = login.data.session?.access_token;
    assert(token, "Auth did not issue an access token");
    const verified = await db.auth.getUser(token);
    assert(
      !verified.error && verified.data.user,
      "Auth identity could not be verified",
    );
    const user = verified.data.user;
    const player = await db
      .from("players")
      .select("id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();
    const profile = await db
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();
    assert(
      !player.error && !profile.error && player.data?.id && profile.data?.id,
      "Technical accounts must complete normal profile onboarding first; runner will not edit profiles",
    );
    Object.assign(actors.at(-1), { user, player: player.data.id, token });
    check(
      user.email_confirmed_at && !user.is_anonymous,
      `confirmed_auth_${label}`,
      { actor: label },
    );
  }
  assertIdentities(actors);
  check(true, "three_distinct_real_jwt_identities");
  anonymous = client();
}
function scope(table, group, id) {
  assert(
    tables.includes(table) && state.groups.some((g) => g.id === group),
    "Write outside synthetic scope refused",
  );
  if (id)
    assert(
      state.rows.some(
        (r) => r.table === table && r.group === group && r.id === id,
      ),
      "Unknown synthetic row; write refused",
    );
}
function attempt(label, table, group) {
  current = label;
  const a = {
    operation: randomUUID(),
    label,
    table,
    group,
    phase: "attempted",
  };
  state.attempts.push(a);
  save();
  return a;
}
async function insert(db, table, group, values, label) {
  scope(table, group);
  const a = attempt(label, table, group);
  const r = await db
    .from(table)
    .insert({ ...values, group_id: group })
    .select("*");
  assert(
    !r.error && r.data?.length === 1,
    "Expected one inserted synthetic row",
  );
  uuid(r.data[0].id);
  state.rows.push({ table, group, id: r.data[0].id });
  a.phase = "confirmed";
  save();
  check(true, label, { table, operation: "insert", status: r.status });
  return r.data[0];
}
async function read(db, table, group) {
  const r = await db.from(table).select("*").eq("group_id", group).order("id");
  assert(!r.error && Array.isArray(r.data), "Synthetic snapshot unavailable");
  return r.data;
}
async function snapshot(table) {
  return Promise.all(
    state.groups.map((g, i) => read(actors[i].db, table, g.id)),
  );
}
async function deniedWrite(
  actor,
  table,
  group,
  id,
  verb,
  values,
  label,
  codes = ["42501"],
) {
  scope(table, group, id);
  const before = await snapshot(table);
  const a = attempt(label, table, group);
  if (id)
    assert(
      before.flat().some((row) => row.id === id),
      "Expected synthetic target missing before denial",
    );
  const details = await verifyDenied(
    async () => {
      let q = actor.db.from(table);
      if (verb === "insert") q = q.insert({ ...values, group_id: group });
      else {
        q = verb === "update" ? q.update(values) : q.delete();
        q = q.eq("group_id", group).eq("id", id);
      }
      return await q.select("*");
    },
    before,
    () => snapshot(table),
    codes,
    verb !== "insert",
  );
  a.phase = "denied_unchanged";
  save();
  check(true, label, {
    actor: actor.label,
    table,
    operation: verb,
    ...details,
  });
}
async function rosterSnapshot() {
  return Promise.all(
    state.groups.map(async (g, i) => {
      const r = await actors[i].db
        .from("group_members")
        .select("id,player_id,role,status,updated_at")
        .eq("group_id", g.id)
        .order("id");
      assert(!r.error, "Synthetic roster snapshot unavailable");
      return r.data;
    }),
  );
}
async function deniedMembershipRpc(actor, rpc, values, label) {
  const before = await rosterSnapshot();
  attempt(label, "group_members", state.groups[0].id);
  const details = await verifyDenied(
    () => actor.db.rpc(rpc, values),
    before,
    rosterSnapshot,
  );
  check(true, label, { actor: actor.label, operation: "rpc", ...details });
}
async function update(db, table, group, row, values, label) {
  scope(table, group, row.id);
  const a = attempt(label, table, group);
  const r = await db
    .from(table)
    .update(values)
    .eq("group_id", group)
    .eq("id", row.id)
    .select("*");
  assert(
    !r.error && r.data?.length === 1,
    "Expected one updated synthetic row",
  );
  const stored = (await read(db, table, group)).find((x) => x.id === row.id);
  assert(
    stored && Object.entries(values).every(([k, v]) => stored[k] === v),
    "Update readback mismatch",
  );
  a.phase = "confirmed";
  save();
  check(true, label, { table, operation: "update", status: r.status });
}
async function prepare() {
  for (const table of tables) {
    const r = await actors[0].db
      .from(table)
      .select("id")
      .eq("group_id", randomUUID())
      .limit(1);
    assert(
      !r.error,
      "Applied table is unavailable; confirm the authorized migration before fixture creation",
    );
  }
  state.identities = actors.map((a) => ({ user: a.user.id, player: a.player }));
  state.phase = "creating_groups";
  save();
  for (let i = 0; i < 2; i++) {
    const slug = `audit-0042-${i === 0 ? "a" : "b"}-${state.run}`,
      request = randomUUID();
    state.attempts.push({
      label: `create_group_${i}`,
      request,
      slug,
      phase: "attempted",
    });
    save();
    const r = await actors[i].db.rpc("create_group_once", {
      p_request_id: request,
      p_name: `Homologação 004.2 ${state.run} ${i === 0 ? "A" : "B"}`,
      p_slug: slug,
      p_description: `Synthetic HTTP audit ${state.run}`,
      p_timezone: "UTC",
    });
    assert(
      !r.error && typeof r.data === "string",
      "Synthetic group creation failed; inspect manifest before any retry",
    );
    uuid(r.data);
    state.groups.push({ id: r.data, slug, owner: actors[i].user.id });
    state.attempts.at(-1).phase = "confirmed";
    save();
  }
  validateManifest(state, state.run, actors);
  const seed = `work/stage0042-http-${state.run}-membership.sql`;
  writeFileSync(seed, membershipSeed(state), { mode: 0o600, flag: "wx" });
  state.phase = "awaiting_membership";
  state.result = "BLOCKED_MEMBERSHIP_SETUP";
  state.membershipSeed = seed;
  save();
}
async function validateFixtures() {
  current = "verify_synthetic_fixture_scope";
  validateManifest(state, state.run, actors);
  assert(
    state.phase === "awaiting_membership" &&
      state.result === "BLOCKED_MEMBERSHIP_SETUP" &&
      state.rows.length === 0,
    "This run already started or failed; never replay a partial suite automatically",
  );
  for (let i = 0; i < 2; i++) {
    const g = state.groups[i],
      owner = actors[i];
    const r = await owner.db
      .from("groups")
      .select("id,slug,created_by,timezone,deleted_at")
      .eq("id", g.id)
      .single();
    assert(
      !r.error &&
        r.data.slug === g.slug &&
        r.data.created_by === owner.user.id &&
        r.data.timezone === "UTC" &&
        !r.data.deleted_at,
      "Wrong synthetic group",
    );
    const roster = await owner.db
      .from("group_members")
      .select("id,player_id,role,status")
      .eq("group_id", g.id);
    assert(
      !roster.error && roster.data.length === (i === 0 ? 2 : 1),
      "Unexpected fixture membership count",
    );
    const o = roster.data.filter(
      (m) => m.role === "owner" && m.status === "active",
    );
    assert(
      o.length === 1 && o[0].player_id === owner.player,
      "Wrong synthetic owner",
    );
    state.groups[i].ownerMember = o[0].id;
    if (i === 0) {
      const c = roster.data.find((m) => m.player_id === actors[2].player);
      assert(
        c?.role === "player" && c.status === "active",
        "Technical C must have exactly the new player/active link",
      );
      uuid(c.id);
      state.memberC = c.id;
    }
    for (const table of tables)
      assert(
        (await read(owner.db, table, g.id)).length === 0,
        "Synthetic configuration tables must start empty",
      );
  }
  const privateProbe = await actors[0].db
    .schema("private")
    .from("membership_events")
    .select("id")
    .eq("member_id", state.memberC)
    .limit(1);
  check(privateProbe.error?.code === "PGRST106", "private_schema_not_exposed", {
    operation: "select",
    status: privateProbe.status,
    code: codeOf(privateProbe),
  });
  check(true, "synthetic_fixture_scope_verified");
}
async function changeRole(role) {
  const [a, , c] = actors,
    ga = state.groups[0].id;
  current = `set_C_${role}`;
  const r = await a.db.rpc("set_member_role", {
    p_group_id: ga,
    p_member_id: state.memberC,
    p_role: role,
  });
  assert(!r.error, "Role setup refused");
  const m = await c.db
    .from("group_members")
    .select("id,role,status")
    .eq("id", state.memberC)
    .eq("group_id", ga)
    .single();
  assert(
    !m.error && m.data.role === role && m.data.status === "active",
    "Real membership role verification failed",
  );
  state.roleC = role;
  save();
  check(true, `real_membership_C_${role}`, { actor: "C", role });
}
async function runMatrix() {
  const [a, b, c] = actors,
    [ga, gb] = state.groups.map((g) => g.id);
  const day = (offset) =>
      new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10),
    start = day(30),
    end = day(37);
  const schedule = {
    weekday: new Date(start + "T12:00:00Z").getUTCDay(),
    starts_at_local: "19:00:00",
    duration_minutes: 90,
    recurrence_type: "weekly",
    interval_weeks: 1,
    starts_on: start,
    ends_on: null,
    is_active: true,
  };
  const pricing = (offset = 30) => ({
    monthly_enabled: true,
    monthly_amount_cents: 5000,
    casual_enabled: true,
    casual_amount_cents: 2000,
    due_day: 10,
    effective_from: day(offset),
    effective_until: day(offset + 7),
  });
  const term = (player, offset = 30) => ({
    player_id: player,
    billing_type: "casual",
    effective_from: day(offset),
    effective_until: day(offset + 7),
  });
  if (state.failure) {
    (state.preparationFailures ??= []).push(state.failure);
    delete state.failure;
  }
  state.executedWith = codeVersion();
  state.executionStartedAt = new Date().toISOString();
  state.phase = "http_matrix";
  state.result = "RUNNING";
  save();
  for (let i = 0; i < 2; i++) {
    const actor = actors[i],
      g = state.groups[i].id;
    const r = await actor.db
      .from("venues")
      .insert({ group_id: g, name: `Synthetic HTTP venue ${state.run}` })
      .select("id")
      .single();
    assert(!r.error && r.data, "Synthetic venue failed");
    state.venues.push({ id: uuid(r.data.id), group: g });
    save();
  }
  const sa = await insert(
    a.db,
    tables[0],
    ga,
    { ...schedule, venue_id: state.venues[0].id },
    "owner_schedule_insert",
  );
  const pa = await insert(
    a.db,
    tables[1],
    ga,
    pricing(),
    "owner_pricing_insert",
  );
  const tc = await insert(
    a.db,
    tables[2],
    ga,
    term(c.player),
    "owner_classification_insert",
  );
  await insert(
    a.db,
    tables[2],
    ga,
    { ...term(a.player), billing_type: "monthly" },
    "owner_other_member_classification",
  );
  const sb = await insert(
    b.db,
    tables[0],
    gb,
    schedule,
    "owner_B_schedule_insert",
  );
  const pb = await insert(
    b.db,
    tables[1],
    gb,
    pricing(),
    "owner_B_pricing_insert",
  );
  const tb = await insert(
    b.db,
    tables[2],
    gb,
    term(b.player),
    "owner_B_classification_insert",
  );
  const base = { [tables[0]]: sa, [tables[1]]: pa, [tables[2]]: tc };
  for (const table of tables)
    check((await read(a.db, table, ga)).length > 0, `owner_read_${table}`, {
      actor: "A",
      operation: "select",
      table,
    });
  await update(
    a.db,
    tables[0],
    ga,
    sa,
    { duration_minutes: 100 },
    "owner_schedule_update",
  );
  await update(
    a.db,
    tables[1],
    ga,
    pa,
    { casual_amount_cents: 2100 },
    "owner_pricing_update",
  );
  await update(
    a.db,
    tables[2],
    ga,
    tc,
    { effective_until: day(38) },
    "owner_classification_update",
  );
  for (const table of tables)
    await deniedWrite(
      a,
      table,
      ga,
      base[table].id,
      "delete",
      null,
      `owner_delete_${table}`,
    );
  await changeRole("admin");
  for (const table of tables)
    check((await read(c.db, table, ga)).length > 0, `admin_read_${table}`, {
      actor: "C",
      operation: "select",
      table,
    });
  await insert(
    c.db,
    tables[0],
    ga,
    { ...schedule, recurrence_type: "biweekly", interval_weeks: 2 },
    "admin_biweekly_schedule_insert",
  );
  await update(
    c.db,
    tables[0],
    ga,
    sa,
    { duration_minutes: 110 },
    "admin_schedule_update",
  );
  await insert(
    c.db,
    tables[2],
    ga,
    term(c.player, 45),
    "admin_classification_insert",
  );
  await insert(
    c.db,
    tables[2],
    ga,
    { ...term(a.player, 45), billing_type: "monthly" },
    "admin_monthly_classification_insert",
  );
  await update(
    c.db,
    tables[2],
    ga,
    tc,
    { effective_until: day(39) },
    "admin_classification_update",
  );
  await deniedWrite(
    c,
    tables[1],
    ga,
    null,
    "insert",
    pricing(60),
    "admin_price_insert_denied",
  );
  await deniedWrite(
    c,
    tables[1],
    ga,
    pa.id,
    "update",
    { monthly_amount_cents: 9000, due_day: 20 },
    "admin_price_due_update_denied",
  );
  for (const table of tables)
    await deniedWrite(
      c,
      table,
      ga,
      base[table].id,
      "delete",
      null,
      `admin_delete_${table}`,
    );
  for (const role of ["player", "guest"]) {
    await changeRole(role);
    await deniedMembershipRpc(
      c,
      "set_member_role",
      { p_group_id: ga, p_member_id: state.memberC, p_role: "owner" },
      `${role}_self_promotion_denied`,
    );
    for (const table of tables) {
      const rows = await read(c.db, table, ga);
      check(
        rows.length > 0 &&
          (table !== tables[2] || rows.every((r) => r.player_id === c.player)),
        `${role}_authorized_read_${table}`,
        { actor: "C", operation: "select", table },
      );
    }
    const others = await c.db
      .from(tables[2])
      .select("id")
      .eq("group_id", ga)
      .eq("player_id", a.player);
    check(
      !others.error && others.data.length === 0,
      `${role}_other_member_financial_privacy`,
      { actor: "C", operation: "select" },
    );
    for (const [table, payload] of [
      [tables[0], schedule],
      [tables[1], pricing(60)],
      [tables[2], term(c.player, 60)],
    ]) {
      await deniedWrite(
        c,
        table,
        ga,
        null,
        "insert",
        payload,
        `${role}_insert_${table}`,
      );
      await deniedWrite(
        c,
        table,
        ga,
        base[table].id,
        "update",
        table === tables[0]
          ? { duration_minutes: 120 }
          : table === tables[1]
            ? { due_day: 12 }
            : { billing_type: "monthly" },
        `${role}_update_${table}`,
      );
      await deniedWrite(
        c,
        table,
        ga,
        base[table].id,
        "delete",
        null,
        `${role}_delete_${table}`,
      );
    }
  }
  await deniedMembershipRpc(
    a,
    "set_member_role",
    { p_group_id: gb, p_member_id: state.memberC, p_role: "admin" },
    "forged_member_group_binding_denied",
  );
  for (const [table, row, payload] of [
    [tables[0], sb, schedule],
    [tables[1], pb, pricing(70)],
    [tables[2], tb, term(b.player, 70)],
  ]) {
    await deniedWrite(
      a,
      table,
      gb,
      null,
      "insert",
      payload,
      `A_foreign_insert_${table}`,
    );
    await deniedWrite(
      a,
      table,
      gb,
      row.id,
      "update",
      table === tables[0]
        ? { duration_minutes: 120 }
        : table === tables[1]
          ? { due_day: 12 }
          : { billing_type: "monthly" },
      `A_foreign_update_${table}`,
    );
    await deniedWrite(
      a,
      table,
      gb,
      row.id,
      "delete",
      null,
      `A_foreign_delete_${table}`,
    );
  }
  // B is a legitimate owner in B, but has no membership in A. Check both directions.
  for (const [actor, foreign] of [
    [a, gb],
    [b, ga],
  ])
    for (const table of tables) {
      const r = await actor.db.from(table).select("id").eq("group_id", foreign);
      check(
        !r.error && r.data.length === 0,
        `${actor.label}_foreign_read_${table}`,
        { actor: actor.label, operation: "select", table },
      );
    }
  for (const [table, payload] of [
    [tables[0], schedule],
    [tables[1], pricing(70)],
    [tables[2], term(c.player, 70)],
  ]) {
    await deniedWrite(
      b,
      table,
      ga,
      null,
      "insert",
      payload,
      `foreign_insert_${table}`,
    );
    await deniedWrite(
      b,
      table,
      ga,
      base[table].id,
      "update",
      table === tables[0]
        ? { duration_minutes: 120 }
        : table === tables[1]
          ? { due_day: 12 }
          : { billing_type: "monthly" },
      `foreign_update_${table}`,
    );
    await deniedWrite(
      b,
      table,
      ga,
      base[table].id,
      "delete",
      null,
      `foreign_delete_${table}`,
    );
    const r = await anonymous.from(table).select("id").eq("group_id", ga);
    check(
      r.error?.code === "42501" && r.status >= 400 && r.status < 500,
      `anonymous_read_${table}`,
      {
        actor: "anonymous",
        operation: "select",
        table,
        status: r.status,
        code: codeOf(r),
      },
    );
    for (const verb of ["insert", "update", "delete"])
      await deniedWrite(
        { db: anonymous, label: "anonymous" },
        table,
        ga,
        verb === "insert" ? null : base[table].id,
        verb,
        verb === "insert"
          ? payload
          : table === tables[0]
            ? { duration_minutes: 120 }
            : table === tables[1]
              ? { due_day: 12 }
              : { billing_type: "monthly" },
        `anonymous_${verb}_${table}`,
      );
  }
  for (const table of tables)
    for (const [column, value] of [
      ["id", randomUUID()],
      ["group_id", gb],
      ["created_at", new Date().toISOString()],
    ])
      await deniedWrite(
        a,
        table,
        ga,
        base[table].id,
        "update",
        { [column]: value },
        `immutable_${table}_${column}`,
      );
  await deniedWrite(
    a,
    tables[2],
    ga,
    tc.id,
    "update",
    { player_id: b.player },
    "immutable_player_id",
  );
  await deniedWrite(
    a,
    tables[0],
    ga,
    null,
    "insert",
    { ...schedule, venue_id: state.venues[1].id },
    "cross_tenant_venue",
    ["23503"],
  );
  await deniedWrite(
    a,
    tables[2],
    ga,
    null,
    "insert",
    term(b.player, 70),
    "cross_tenant_member",
    ["23503"],
  );
  for (const [label, payload] of [
    ["duration", { duration_minutes: 0 }],
    ["weekday", { weekday: 7 }],
    ["anchor", { weekday: (schedule.weekday + 1) % 7 }],
    ["end", { ends_on: day(29) }],
    ["weekly_interval", { interval_weeks: 2 }],
    ["biweekly_interval", { recurrence_type: "biweekly", interval_weeks: 1 }],
  ])
    await deniedWrite(
      a,
      tables[0],
      ga,
      null,
      "insert",
      { ...schedule, ...payload },
      `constraint_schedule_${label}`,
      ["23514"],
    );
  for (const [label, payload] of [
    ["negative", { monthly_amount_cents: -1 }],
    ["due_0", { due_day: 0 }],
    ["due_32", { due_day: 32 }],
    ["missing_enabled_amount", { monthly_amount_cents: null }],
    ["dates", { effective_until: day(59) }],
  ])
    await deniedWrite(
      a,
      tables[1],
      ga,
      null,
      "insert",
      { ...pricing(60), ...payload },
      `constraint_pricing_${label}`,
      ["23514"],
    );
  await deniedWrite(
    a,
    tables[1],
    ga,
    null,
    "insert",
    pricing(),
    "pricing_overlap",
    ["23P01"],
  );
  await deniedWrite(
    a,
    tables[2],
    ga,
    null,
    "insert",
    term(c.player),
    "classification_overlap",
    ["23P01"],
  );
  await deniedWrite(
    a,
    tables[2],
    ga,
    null,
    "insert",
    { ...term(c.player, 60), billing_type: "monthly" },
    "guest_monthly_forbidden",
    ["23514"],
  );
  await deniedWrite(
    a,
    tables[2],
    ga,
    null,
    "insert",
    { ...term(c.player, 60), effective_until: day(59) },
    "classification_invalid_dates",
    ["23514"],
  );
  const currentPolicy = await insert(
    a.db,
    tables[1],
    ga,
    { ...pricing(), effective_from: day(0), effective_until: day(1) },
    "current_policy_insert",
  );
  await deniedWrite(
    a,
    tables[1],
    ga,
    currentPolicy.id,
    "update",
    { casual_amount_cents: 3000 },
    "started_policy_immutable",
  );
  await deniedWrite(
    a,
    tables[1],
    ga,
    currentPolicy.id,
    "update",
    { effective_until: day(0) },
    "retroactive_end_forbidden",
    ["23514"],
  );
  await deniedWrite(
    a,
    tables[1],
    ga,
    null,
    "insert",
    { ...pricing(), effective_from: day(-2), effective_until: day(-1) },
    "retroactive_policy_insert_forbidden",
    ["23514"],
  );
  const currentTerm = await insert(
    a.db,
    tables[2],
    ga,
    { ...term(a.player), effective_from: day(0), effective_until: day(1) },
    "current_classification_insert",
  );
  await deniedWrite(
    a,
    tables[2],
    ga,
    currentTerm.id,
    "update",
    { billing_type: "monthly" },
    "started_classification_immutable",
  );
  await insert(
    a.db,
    tables[1],
    ga,
    { ...pricing(), effective_from: end, effective_until: day(44) },
    "adjacent_policy_accepted",
  );
  // Actual concurrent HTTP transactions; no RPC/claim simulation and no retries.
  for (const table of [tables[1], tables[2]]) {
    const payload = table === tables[1] ? pricing(100) : term(c.player, 100);
    attempt(`race_${table}`, table, ga);
    const r = await Promise.all(
      [0, 1].map(() =>
        a.db
          .from(table)
          .insert({ ...payload, group_id: ga })
          .select("id"),
      ),
    );
    for (const response of r)
      if (!response.error && response.data?.length === 1)
        state.rows.push({ table, group: ga, id: uuid(response.data[0].id) });
    save();
    check(
      r.filter((x) => !x.error && x.data?.length === 1).length === 1 &&
        r.filter((x) => x.error?.code === "23P01").length === 1,
      `concurrent_overlap_${table}`,
      { operation: "concurrency", table },
    );
  }
  for (let i = 0; i < 2; i++) {
    const r = await actors[i].db
      .from("group_members")
      .select("id,player_id,role,status")
      .eq("group_id", state.groups[i].id);
    assert(!r.error, "Roster verification failed");
    const owners = r.data.filter(
      (x) => x.role === "owner" && x.status === "active",
    );
    check(
      owners.length === 1 && owners[0].player_id === actors[i].player,
      `original_owner_${i}_preserved`,
    );
    if (i === 0)
      check(
        r.data.some(
          (x) =>
            x.id === state.memberC &&
            x.role === "guest" &&
            x.status === "active",
        ),
        "C_final_synthetic_link_guest_active",
      );
  }
  check(
    (await read(b.db, tables[0], gb)).some((x) => x.id === sb.id) &&
      (await read(b.db, tables[1], gb)).some((x) => x.id === pb.id) &&
      (await read(b.db, tables[2], gb)).some((x) => x.id === tb.id),
    "group_B_fixtures_preserved",
  );
  state.completedAt = new Date().toISOString();
  state.uniquePassed = uniquePassed();
  state.phase = "completed";
  state.result = "PASS";
  state.finalHomologation = "REQUIRES_REVIEW_OF_LIMITATIONS";
  save();
}
try {
  assert(
    !env.NEXT_PUBLIC_SUPABASE_URL ||
      env.NEXT_PUBLIC_SUPABASE_URL === PROJECT_URL,
    "Wrong project",
  );
  if (mode === "--preflight") {
    const checks = await connectivity();
    console.log(
      JSON.stringify({ mode, connectivity: checks, fixturesCreated: false }),
    );
    process.exitCode = checks.every((c) => c.status !== null) ? 0 : 2;
  } else {
    assertConfiguration(env);
    const branch = execFileSync("git", ["branch", "--show-current"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    assertBranch(branch);
    const connection = await connectivity();
    assert(
      connection.every((c) => c.status === 200),
      "Auth/Data API preflight blocked; no fixtures created",
    );
    if (mode === "--prepare")
      begin(randomUUID(), {
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
          cwd: root,
          encoding: "utf8",
        }).trim(),
        branch,
      });
    else {
      const id = uuid(args[1]);
      manifest = `work/stage0042-http-${id}.json`;
      assert(
        lstatSync(manifest).isFile() && !lstatSync(manifest).isSymbolicLink(),
        "Regular audit manifest required",
      );
      const loaded = JSON.parse(readFileSync(manifest, "utf8"));
      validateManifest(loaded, id);
      assert(
        loaded.phase === "awaiting_membership" &&
          loaded.result === "BLOCKED_MEMBERSHIP_SETUP" &&
          loaded.rows?.length === 0,
        "Run cannot be replayed",
      );
      state = loaded;
    }
    await authenticate();
    if (mode === "--prepare") await prepare();
    else {
      await validateFixtures();
      await runMatrix();
    }
    console.log(
      JSON.stringify({
        result: state.result,
        phase: state.phase,
        run: state.run,
        passed: uniquePassed(),
        failed: 0,
        manifest,
        membershipSeed: state.membershipSeed,
        cleanup: "none",
        limitations: state.limitations,
      }),
    );
  }
} catch {
  // Assertion/provider messages can contain private values; never print raw errors/stacks.
  if (state) {
    if (state.phase !== "awaiting_membership") state.result = "FAIL";
    state.failure = {
      checkpoint: current,
      category: current.startsWith("authenticate")
        ? "authentication"
        : state.phase === "http_matrix"
          ? "authorization_or_integrity"
          : "configuration_or_fixture_setup",
      detailsSuppressed: true,
    };
    save();
  }
  console.log(
    JSON.stringify({
      result: "BLOCKED_OR_FAIL",
      phase: state?.phase ?? "preflight",
      checkpoint: current,
      passed: uniquePassed(),
      failed: state ? 1 : 0,
      manifest: manifest ?? null,
      detailsSuppressed: true,
      cleanup: "none",
    }),
  );
  process.exitCode = 1;
} finally {
  for (const actor of actors) {
    try {
      await actor.db.auth.signOut({ scope: "local" });
    } catch {
      /* New test session only; never print tokens or retry failures. */
    }
  }
}
