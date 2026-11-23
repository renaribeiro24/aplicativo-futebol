import { membershipSeed } from "./stage0042-http-guards.mjs";
import { spawn, spawnSync } from "node:child_process";
import {
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Always a new local container, no ports, no network, no user-provided connection URL.
const root = fileURLToPath(new URL("../", import.meta.url));
const container = `futebol-db-test-${randomUUID()}`;
const image =
  "postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3";
const env = { ...process.env };
for (const key of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[key];
const dockerArgs = ["--host=unix:///var/run/docker.sock"];
function docker(args, input, allowFailure = false) {
  const result = spawnSync("docker", [...dockerArgs, ...args], {
    cwd: root,
    env,
    input,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure)
    throw new Error(result.stderr || result.stdout || "Docker failed");
  return result;
}
const sqlArgs = [
  "exec",
  "-i",
  container,
  "psql",
  "-X",
  "-q",
  "-t",
  "-A",
  "-U",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
];
function sql(text) {
  return docker(sqlArgs, text);
}
function sqlAsync(text) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [...dockerArgs, ...sqlArgs], {
      cwd: root,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (value) => {
      stdout += value;
    });
    child.stderr.on("data", (value) => {
      stderr += value;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(text);
  });
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  docker(["info", "--format", "{{.ServerVersion}}"]);
  docker([
    "run",
    "--detach",
    "--rm",
    "--network",
    "none",
    "--name",
    container,
    "--env",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    image,
  ]);
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (
      docker(
        [
          "exec",
          container,
          "sh",
          "-c",
          'test "$(cat /proc/1/comm)" = postgres && pg_isready -U postgres',
        ],
        undefined,
        true,
      ).status === 0
    ) {
      ready = true;
      break;
    }
    await sleep(250);
  }
  if (!ready) throw new Error("Disposable PostgreSQL did not become ready");
  sql(readFileSync(path.join(root, "tests/database/bootstrap.sql"), "utf8"));
  const migrations = readdirSync(path.join(root, "supabase/migrations"))
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort();
  if (!migrations.length) throw new Error("No versioned migrations found");
  const primaryMigration = migrations.find((name) =>
    name.endsWith("_stage0042l_primary_venue.sql"),
  );
  const memberMigration = migrations.find((name) => name.endsWith("_member_foundation.sql"));
  // Apply legacy contract regressions before checking intentionally changed contracts.
  // Apply every migration in order; the new rule preserves unconfigured groups.
  for (const name of migrations) {
    if (name === memberMigration) continue;
    if (memberMigration && name === primaryMigration) {
      const proposed = readFileSync(path.join(root, "supabase/migrations", memberMigration), "utf8");
      const assertions = readFileSync(path.join(root, "tests/database/member-foundation.sql"), "utf8")
        .replace("\nbegin;", "\n").replace(/\nrollback;\s*$/, "\n");
      const checked = sql("begin;" + proposed + ";" + assertions + ";rollback;");
      console.log("members foundation baseline-8 OK: " + checked.stderr.split("\n").filter(line => line.includes("NOTICE:") && line.includes("ok -")).length + " SQL assertions; location L not installed");
      if (sql("select to_regclass('public.member_participation_periods') is null;").stdout.trim() !== "t")
        throw Error("Baseline-8 test did not roll back");
    }
    if (name.endsWith("_auth_schema_bridge.sql")) {
      // Reproduce hosted Supabase: migration administrator cannot delegate auth USAGE.
      sql("revoke usage on schema auth from app_executor;");
      const migration = readFileSync(
        path.join(root, "supabase/migrations", name),
        "utf8",
      );
      // Fail AFTER CREATE/REPLACE to prove the single statement rolls all DDL back.
      const broken = migration.replace(
        "  if pg_catalog.has_function_privilege('anon'",
        "  if true or pg_catalog.has_function_privilege('anon'",
      );
      const rejected = docker(sqlArgs, broken, true);
      if (
        rejected.status === 0 ||
        !rejected.stderr.includes("Unexpected bridge execute permissions")
      )
        throw new Error("Expected bridge postcondition rejection");
      if (
        sql(
          "select to_regprocedure('private.auth_user_id()') is null;",
        ).stdout.trim() !== "t"
      )
        throw new Error("Failed bridge migration left committed DDL");
      console.log(
        "migration rollback OK: forced postcondition error leaves no bridge; real preconditions recheck all original functions",
      );
    }
    if (name === primaryMigration) {
      const primarySql = readFileSync(
        path.join(root, "supabase/migrations", name),
        "utf8",
      );
      const fixtures = readFileSync(
        path.join(root, "tests/database/fixtures.sql"),
        "utf8",
      )
        .replace(/^begin;\s*$/m, "")
        .replace(/commit;\s*$/, "");
      const snapshot = `select jsonb_build_object(
        'groups',(select jsonb_agg(to_jsonb(g)-'primary_venue_id' order by id) from public.groups g),
        'venues',(select jsonb_agg(to_jsonb(v)-array['postal_code','street','street_number','complement','neighborhood','city','state','latitude','longitude','location_provider','external_place_id','superseded_at'] order by id) from public.venues v),
        'schedules',(select jsonb_agg(to_jsonb(s) order by id) from public.group_schedules s),
        'matches',(select jsonb_agg(to_jsonb(m) order by id) from public.matches m)) as payload`;
      // Entire synthetic fixture + migration proof is rolled back, then the
      // migration is applied for the real full post-schema regression suite.
      sql(`begin;${fixtures}
        select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
        insert into public.group_schedules(group_id,venue_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on)
        select g.id,v.id,1,'19:00',90,'weekly',1,'2030-01-07' from public.groups g join public.venues v on v.group_id=g.id where g.slug='test-alpha';
        insert into public.group_schedules(group_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on)
        select id,1,'18:00',90,'weekly',1,'2030-01-07' from public.groups where slug='test-alpha';
        create temporary table stage_l_before as ${snapshot};
        ${primarySql}
        do $$ declare after_value jsonb; begin
          ${snapshot.replace(" as payload", " into after_value")};
          if after_value is distinct from (select payload from stage_l_before) then raise exception 'Legacy snapshot changed'; end if;
          if exists(select 1 from public.groups where primary_venue_id is not null) then raise exception 'Unexpected backfill'; end if;
        end $$;rollback;`);
      const rejected = docker(
        sqlArgs,
        `begin;${primarySql}select 1/0;commit;`,
        true,
      );
      if (
        rejected.status === 0 ||
        sql(
          "select to_regprocedure('private.assign_schedule_primary_venue()') is null and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='groups' and column_name='primary_venue_id');",
        ).stdout.trim() !== "t"
      )
        throw Error("Primary migration DDL rollback failed");

      for (const [drift, expected] of [
        [
          "alter table public.groups disable row level security;",
          "Unexpected table ownership or RLS state",
        ],
        [
          "grant update on public.groups to authenticated;",
          "Unexpected direct primary pointer grant",
        ],
        [
          "grant insert on public.venues to authenticated;",
          "Unexpected direct structured venue grant",
        ],
      ]) {
        const rejectedDrift = docker(
          sqlArgs,
          `begin;${drift}${primarySql}commit;`,
          true,
        );
        if (
          rejectedDrift.status === 0 ||
          !rejectedDrift.stderr.includes(expected)
        )
          throw Error("Privilege/RLS drift did not block migration");
        if (
          sql(
            "select to_regprocedure('private.assign_schedule_primary_venue()') is null and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='groups' and column_name='primary_venue_id') and (select relrowsecurity from pg_class where oid='public.groups'::regclass);",
          ).stdout.trim() !== "t"
        )
          throw Error("Rejected drift left DDL or RLS changes");
      }
      console.log(
        "stage0042-L preconditions OK: RLS disabled/broad group update/broad venue insert rejected and rolled back",
      );
      console.log(
        "stage0042-L preservation/rollback OK: legacy rows/timestamps/addresses/schedules/matches unchanged; no backfill or leaked DDL",
      );
    }
    sql(
      `BEGIN;\n${readFileSync(path.join(root, "supabase/migrations", name), "utf8")}\nCOMMIT;`,
    );
    console.log(`migration OK: ${name}`);
  }
  sql(readFileSync(path.join(root, "tests/database/fixtures.sql"), "utf8"));
  const result = sql(
    readFileSync(path.join(root, "tests/database/security.sql"), "utf8"),
  );
  const assertions = (result.stderr.match(/NOTICE:\s+ok -/g) ?? []).length;
  console.log(
    `security OK: ${assertions} SQL assertions (non-privileged authenticated/anon sessions)`,
  );

  sql(readFileSync(path.join(root, "tests/database/auth-bridge.sql"), "utf8"));
  console.log(
    "auth bridge OK: no auth USAGE/SELECT, exact identity/null handling, direct client execution denied",
  );

  sql(
    readFileSync(
      path.join(root, "tests/database/development-smoke.sql"),
      "utf8",
    ),
  );
  console.log(
    "development SQL smoke OK: authenticated groups/guests/invitations, isolation, anonymous denial, rollback",
  );

  sql(readFileSync(path.join(root, "tests/database/stage003.sql"), "utf8"));
  console.log(
    "stage003 SQL OK: identity, groups, guests, isolation, idempotency and rollback",
  );

  const settings = sql(
    readFileSync(path.join(root, "tests/database/stage0042i.sql"), "utf8"),
  );
  console.log(
    `stage0042i OK: ${(settings.stderr.match(/NOTICE:\s+ok -/g) ?? []).length} SQL assertions; actual settings persistence, manager permissions and tenant isolation`,
  );

  const stage42 = sql(
    readFileSync(path.join(root, "tests/database/stage0042.sql"), "utf8"),
  );
  console.log(
    `stage0042 OK: ${(stage42.stderr.match(/NOTICE:\s+ok -/g) ?? []).length} SQL assertions; schedules, pricing, classification, RLS and history`,
  );

  // Stage 004.2: exclusion constraints and authorization after waiting for tenant lock.
  const pricingInsert = `insert into public.group_pricing_policies(group_id,monthly_enabled,casual_enabled,effective_from) select id,false,false,(clock_timestamp() at time zone timezone)::date+7 from public.groups where slug='test-alpha';`;
  const billingInsert = `insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) select g.id,p.id,'casual',(clock_timestamp() at time zone g.timezone)::date+7 from public.groups g cross join public.players p where g.slug='test-alpha' and p.user_id='00000000-0000-4000-8000-000000000003';`;
  const ownerSession = `begin; set session authorization authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);`;
  for (const [label, statement, table] of [
    ["pricing", pricingInsert, "group_pricing_policies"],
    ["member terms", billingInsert, "member_billing_terms"],
  ]) {
    const first = sqlAsync(
      `${ownerSession}${statement} select pg_sleep(0.5); commit;`,
    );
    await sleep(100);
    const results = await Promise.all([
      first,
      sqlAsync(`${ownerSession}${statement} commit;`),
    ]);
    if (
      results.filter((r) => r.code === 0).length !== 1 ||
      !results.some((r) => r.stderr.includes("exclusion constraint"))
    )
      throw new Error(`Stage0042 ${label} overlap race failed`);
    if (
      sql(
        `select count(*) from public.${table} t join public.groups g on g.id=t.group_id where g.slug='test-alpha';`,
      ).stdout.trim() !== "1"
    )
      throw new Error(`Stage0042 ${label} overlap race left unexpected rows`);
    console.log(
      `stage0042 concurrency OK: ${label} overlap has exactly one winner`,
    );
  }
  const demoteAdmin = sqlAsync(`${ownerSession}
    select public.set_member_role(g.id,m.id,'player') from public.groups g join public.group_members m on m.group_id=g.id join public.players p on p.id=m.player_id where g.slug='test-alpha' and p.user_id='00000000-0000-4000-8000-000000000004';
    select pg_sleep(0.5); commit;`);
  await sleep(100);
  const staleAdmin =
    sqlAsync(`begin; set session authorization authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
    insert into public.group_schedules(group_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on)
    select id,extract(dow from current_date+7)::int,'19:30',90,'weekly',1,current_date+7 from public.groups where slug='test-alpha'; commit;`);
  const roleRace = await Promise.all([demoteAdmin, staleAdmin]);
  if (
    roleRace[0].code !== 0 ||
    roleRace[1].code === 0 ||
    !roleRace[1].stderr.includes("Permissão insuficiente")
  )
    throw new Error(
      "Stage0042 stale admin was not rejected after waiting for tenant lock",
    );
  if (sql("select count(*) from public.group_schedules;").stdout.trim() !== "0")
    throw new Error("Stage0042 stale admin persisted a schedule");
  console.log(
    "stage0042 concurrency OK: demoted admin cannot write after waiting for tenant lock",
  );
  // Restore ONLY this synthetic local fixture through the existing owner RPC.
  sql(
    `${ownerSession} select public.set_member_role(g.id,m.id,'admin') from public.groups g join public.group_members m on m.group_id=g.id join public.players p on p.id=m.player_id where g.slug='test-alpha' and p.user_id='00000000-0000-4000-8000-000000000004'; commit;`,
  );

  // Two transactions compete for the same final seat. PostgreSQL row locks, not mocks.
  const lookup = `select g.id as ga,m.id as match_id,p.id as pc from public.groups g join public.matches m on m.group_id=g.id join public.players p on p.user_id='00000000-0000-4000-8000-000000000003' where g.slug='test-alpha' and m.title='Synthetic limited match' \\gset\n`;
  const first = sqlAsync(
    `begin;\n${lookup}set session authorization authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true); insert into public.match_attendance(group_id,match_id,player_id,status) values(:'ga',:'match_id',:'pc','confirmed'); select pg_sleep(1); commit;`,
  );
  await sleep(250);
  const second = sqlAsync(
    `begin;\n${lookup}select id as pf from public.players where user_id='00000000-0000-4000-8000-000000000006' \\gset\nset session authorization authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true); insert into public.match_attendance(group_id,match_id,player_id,status) values(:'ga',:'match_id',:'pf','confirmed'); commit;`,
  );
  const races = await Promise.all([first, second]);
  if (
    races.filter((r) => r.code === 0).length !== 1 ||
    !races.some((r) => r.stderr.includes("Sem vagas"))
  )
    throw new Error(
      `Capacity race did not enforce one winner: ${JSON.stringify(races)}`,
    );
  const count = sql(
    "select count(*) from public.match_attendance a join public.matches m on m.id=a.match_id where m.title='Synthetic limited match' and a.status='confirmed';",
  ).stdout.trim();
  if (count !== "1") throw new Error("Unexpected confirmed count after race");
  console.log(
    "concurrency OK: two authenticated sessions compete for one seat; exactly one commits",
  );
  const duplicateRequest = randomUUID();
  const guestLookup =
    "select id as ga from public.groups where slug='test-alpha' \\gset\n";
  const duplicateGuestSql = `begin;\n${guestLookup}set session authorization authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true); select public.add_guest_once('${duplicateRequest}',:'ga','Synthetic concurrent guest','','defender');`;
  const guestFirst = sqlAsync(
    `${duplicateGuestSql} select pg_sleep(1); commit;`,
  );
  await sleep(250);
  const guestSecond = sqlAsync(`${duplicateGuestSql} commit;`);
  const guestResults = await Promise.all([guestFirst, guestSecond]);
  if (guestResults.some((r) => r.code !== 0))
    throw new Error("Concurrent guest retries failed");
  if (
    sql(
      "select count(*) from public.players where name='Synthetic concurrent guest';",
    ).stdout.trim() !== "1"
  )
    throw new Error("Concurrent retries duplicated a guest");
  console.log(
    "idempotency concurrency OK: two authenticated submissions with the same request create one guest",
  );

  // Stage 003.2: actual concurrent PostgreSQL transactions, disposable DB only.
  const createGroupSql = (actorId, requestId, slug) =>
    `begin; set session authorization authenticated; select set_config('request.jwt.claim.sub','${actorId}',true); select public.create_group_once('${requestId}','Synthetic concurrent group','${slug}','','America/Sao_Paulo');`;
  const userA = "00000000-0000-4000-8000-000000000001";
  const userB = "00000000-0000-4000-8000-000000000002";
  const groupRequest = randomUUID();
  const repeatedGroup = createGroupSql(userA, groupRequest, "stage32-retry");
  const repeatFirst = sqlAsync(
    `${repeatedGroup} select pg_sleep(0.5); commit;`,
  );
  await sleep(100);
  const repeatResults = await Promise.all([
    repeatFirst,
    sqlAsync(`${repeatedGroup} commit;`),
  ]);
  if (repeatResults.some((r) => r.code !== 0))
    throw new Error("Concurrent group retry failed");
  if (
    sql(
      "select count(*) from public.groups where slug='stage32-retry';",
    ).stdout.trim() !== "1"
  )
    throw new Error("Concurrent group retry duplicated a group");
  console.log(
    "group concurrency OK: same actor/request/payload creates one group",
  );

  const collisionFirst = sqlAsync(
    `${createGroupSql(userA, randomUUID(), "stage32-collision")} select pg_sleep(0.5); commit;`,
  );
  await sleep(100);
  const collisionResults = await Promise.all([
    collisionFirst,
    sqlAsync(
      `${createGroupSql(userB, randomUUID(), "stage32-collision")} commit;`,
    ),
  ]);
  if (
    collisionResults.filter((r) => r.code === 0).length !== 1 ||
    !collisionResults.some((r) => r.stderr.includes("duplicate key value"))
  )
    throw new Error(
      "Concurrent slug collision did not reject exactly one request",
    );
  console.log(
    "group concurrency OK: different actors competing for one slug have one winner",
  );

  const distinctResults = await Promise.all([
    sqlAsync(
      `${createGroupSql(userA, randomUUID(), "stage32-distinct-a")} commit;`,
    ),
    sqlAsync(
      `${createGroupSql(userB, randomUUID(), "stage32-distinct-b")} commit;`,
    ),
  ]);
  if (distinctResults.some((r) => r.code !== 0))
    throw new Error("Independent concurrent groups failed");
  const validOwners = sql(
    `select count(*) from public.groups g where g.slug in ('stage32-retry','stage32-collision','stage32-distinct-a','stage32-distinct-b') and (select count(*) from public.group_members m where m.group_id=g.id and m.role='owner' and m.status='active')=1;`,
  ).stdout.trim();
  if (validOwners !== "4")
    throw new Error("Concurrent group creation left an invalid owner count");
  const matchingOwners = sql(
    `select count(*) from public.groups g join public.group_members m on m.group_id=g.id and m.role='owner' and m.status='active' join public.players p on p.id=m.player_id where (g.slug='stage32-distinct-a' and p.user_id='${userA}') or (g.slug='stage32-distinct-b' and p.user_id='${userB}');`,
  ).stdout.trim();
  if (matchingOwners !== "2")
    throw new Error("Concurrent group creation assigned the wrong owner");
  console.log(
    "group concurrency OK: independent groups commit with the correct unique active owner",
  );

  const ownershipLookup = `select g.id as ga,c.id as mc,d.id as md from public.groups g join public.group_members c on c.group_id=g.id join public.players cp on cp.id=c.player_id join public.group_members d on d.group_id=g.id join public.players dp on dp.id=d.player_id where g.slug='test-alpha' and cp.user_id='00000000-0000-4000-8000-000000000003' and dp.user_id='00000000-0000-4000-8000-000000000004' \\gset\n`;
  const actor =
    "set session authorization authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);";
  const transferFirst = sqlAsync(
    `begin;\n${ownershipLookup}${actor} select public.transfer_ownership(:'ga',:'md'); select pg_sleep(1); commit;`,
  );
  await sleep(250);
  const transferSecond = sqlAsync(
    `begin;\n${ownershipLookup}${actor} select public.transfer_ownership(:'ga',:'mc'); commit;`,
  );
  const transfers = await Promise.all([transferFirst, transferSecond]);
  if (
    transfers.filter((r) => r.code === 0).length !== 1 ||
    !transfers.some((r) => r.stderr.includes("Somente o proprietário"))
  )
    throw new Error(
      `Ownership race was not serialized: ${JSON.stringify(transfers)}`,
    );
  console.log(
    "concurrency OK: competing transfers serialize and revalidate the current owner",
  );
  const ownerCount = sql(
    "select count(*) from public.group_members m join public.groups g on g.id=m.group_id where g.slug='test-alpha' and m.role='owner' and m.status='active';",
  ).stdout.trim();
  if (ownerCount !== "1")
    throw new Error("Ownership race left an invalid owner count");
  const auditRun = randomUUID();
  const users = [1, 2, 3].map(
    (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  );
  const identities = users.map((user) => ({
    user,
    player: sql(
      `select id from public.players where user_id='${user}' and deleted_at is null;`,
    ).stdout.trim(),
  }));
  const fixtureGroups = [];
  for (let i = 0; i < 2; i++) {
    const slug = `audit-0042-${i === 0 ? "a" : "b"}-${auditRun}`;
    const result = sql(
      `select set_config('request.jwt.claim.sub','${users[i]}',false); select public.create_group_once('${randomUUID()}','HTTP runner seed local','${slug}','Local synthetic seed validation','UTC');`,
    )
      .stdout.trim()
      .split("\n")
      .at(-1);
    fixtureGroups.push({ id: result, slug });
  }
  const seed = membershipSeed({
    version: 1,
    project: "https://hpbvtqvbtyioqjyelrpb.supabase.co",
    run: auditRun,
    groups: fixtureGroups,
    identities,
  });
  sql(seed);
  const expected = sql(
    `select count(*)=1 from public.group_members where group_id='${fixtureGroups[0].id}' and player_id='${identities[2].player}' and role='player' and status='active';`,
  ).stdout.trim();
  if (expected !== "t")
    throw Error("Generated seed did not create the expected local membership");
  const fingerprint = () =>
    sql(
      "select md5(jsonb_agg(to_jsonb(m) order by id)::text) from public.group_members m;",
    ).stdout.trim();
  const beforeSeedReplay = fingerprint();
  const replay = docker(sqlArgs, seed, true);
  if (
    replay.status === 0 ||
    !replay.stderr.includes("Unexpected group A roster") ||
    fingerprint() !== beforeSeedReplay
  )
    throw Error("Seed replay was not safely rejected");
  console.log(
    "stage0042 HTTP runner seed OK: generated guarded SQL creates one player link; replay rejected without membership changes (local only, not JWT evidence)",
  );
  if (primaryMigration) {
    const result = sql(
      readFileSync(path.join(root, "tests/database/stage0042l.sql"), "utf8"),
    );
    console.log(
      `stage0042-L OK: ${(result.stderr.match(/NOTICE:\s+ok -/g) ?? []).length} SQL assertions`,
    );
    // Re-run unchanged identity/group/settings contracts on the post-migration schema.
    for (const file of [
      "development-smoke.sql",
      "stage003.sql",
      "stage0042i.sql",
    ])
      sql(readFileSync(path.join(root, "tests/database", file), "utf8"));
    console.log(
      "stage0042-L post-migration regression OK: identity/groups/guests/settings",
    );
    const localSession = (user) =>
      `begin;set session authorization authenticated;select set_config('request.jwt.claim.sub','${user}',true);`;
    const callPrimary = (group, venue, expected, version, name, number = "1") =>
      `select public.save_group_primary_venue('${group}','${name}','01310100','Rua sintética','${number}','Bairro','Cidade','SP',${venue ? `'${venue}'` : "null"},${expected ? `'${expected}'` : "null"},${version ? `'${version}'` : "null"},null);`;
    const raceGroup = sql(
      `select set_config('request.jwt.claim.sub','${userA}',false);select public.create_group_once('${randomUUID()}','Concurrent principal','stage42l-race',null,'UTC');`,
    )
      .stdout.trim()
      .split("\n")
      .at(-1);
    const createRace = sqlAsync(
      `${localSession(userA)}${callPrimary(raceGroup, null, null, null, "Winner local")}select pg_sleep(0.5);commit;`,
    );
    await sleep(100);
    const created = await Promise.all([
      createRace,
      sqlAsync(
        `${localSession(userA)}${callPrimary(raceGroup, null, null, null, "Stale local")}commit;`,
      ),
    ]);
    if (
      created.filter((r) => r.code === 0).length !== 1 ||
      !created.some((r) => r.stderr.includes("Configuração alterada"))
    )
      throw Error("Primary creation race did not reject stale writer");
    if (
      sql(
        `select count(*)=1 from public.venues where group_id='${raceGroup}';`,
      ).stdout.trim() !== "t"
    )
      throw Error("Primary race orphan");
    const primary = sql(
      `select primary_venue_id from public.groups where id='${raceGroup}';`,
    ).stdout.trim();
    const version = sql(
      `select updated_at from public.venues where id='${primary}';`,
    ).stdout.trim();
    const editRace = sqlAsync(
      `${localSession(userA)}${callPrimary(raceGroup, primary, primary, version, "Winner local", "2")}select pg_sleep(0.5);commit;`,
    );
    await sleep(100);
    const edited = await Promise.all([
      editRace,
      sqlAsync(
        `${localSession(userA)}${callPrimary(raceGroup, primary, primary, version, "Lost local", "3")}commit;`,
      ),
    ]);
    if (
      edited.filter((r) => r.code === 0).length !== 1 ||
      !edited.some((r) => r.stderr.includes("Local alterado"))
    )
      throw Error("Venue lost update protection failed");
    if (
      sql(
        `select name='Winner local' and street_number='2' from public.venues where id='${primary}';`,
      ).stdout.trim() !== "t"
    )
      throw Error("Rejected address edit persisted");
    console.log(
      "stage0042-L concurrency OK: competing definitions/updates have one winner, no orphan/lost update",
    );
    const adminGroup = sql(
      "select id from public.groups where slug='stage42l-a';",
    ).stdout.trim();
    const adminMember = sql(
      `select m.id from public.group_members m join public.players p on p.id=m.player_id where m.group_id='${adminGroup}' and p.user_id='00000000-0000-4000-8000-000000000004';`,
    ).stdout.trim();
    const principal = sql(
      `select primary_venue_id from public.groups where id='${adminGroup}';`,
    ).stdout.trim();
    const demotion = sqlAsync(
      `${localSession(userA)}select public.set_member_role('${adminGroup}','${adminMember}','player');select pg_sleep(0.5);commit;`,
    );
    await sleep(100);
    const attempt = sqlAsync(
      `${localSession("00000000-0000-4000-8000-000000000004")}${callPrimary(adminGroup, null, principal, null, "Denied after demotion")}commit;`,
    );
    const roles = await Promise.all([demotion, attempt]);
    if (
      roles[0].code !== 0 ||
      roles[1].code === 0 ||
      !roles[1].stderr.includes("Permissão insuficiente")
    )
      throw Error("Waiting demoted manager retained access");
    if (
      sql(
        `select count(*)=0 from public.venues where group_id='${adminGroup}' and name='Denied after demotion';`,
      ).stdout.trim() !== "t"
    )
      throw Error("Demoted admin persisted a venue");
    console.log(
      "stage0042-L concurrency OK: role revalidated after tenant lock",
    );
    const switching = sqlAsync(
      `${localSession(userA)}${callPrimary(raceGroup, null, primary, null, "New principal")}select pg_sleep(0.5);commit;`,
    );
    await sleep(100);
    const scheduleInsert = `insert into public.group_schedules(group_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on)values('${raceGroup}',1,'21:00',90,'weekly',1,'2030-01-07');`;
    const inserted = await Promise.all([
      switching,
      sqlAsync(`${localSession(userA)}${scheduleInsert}commit;`),
    ]);
    if (inserted.some((r) => r.code !== 0))
      throw Error("Schedule/primary switch race failed");
    if (
      sql(
        `select s.venue_id=g.primary_venue_id from public.group_schedules s join public.groups g on g.id=s.group_id where s.group_id='${raceGroup}';`,
      ).stdout.trim() !== "t"
    )
      throw Error("Concurrent schedule did not use locked primary");
    console.log(
      "stage0042-L concurrency OK: new schedule waits and resolves the committed primary",
    );
    // Privileged synthetic maintenance vs client RPC: existing venues_validate
    // may create a reverse-lock conflict, but never an inactive principal.
    const inactiveRace = sqlAsync(
      `begin;select set_config('request.jwt.claim.sub','${userA}',true);select id from public.venues where id='${primary}' for update;select pg_sleep(0.3);update public.venues set deleted_at=now() where id='${primary}';commit;`,
    );
    await sleep(100);
    const currentPointer = sql(
      `select primary_venue_id from public.groups where id='${raceGroup}';`,
    ).stdout.trim();
    const currentOldVersion = sql(
      `select updated_at from public.venues where id='${primary}';`,
    ).stdout.trim();
    const selecting = sqlAsync(
      `${localSession(userA)}${callPrimary(raceGroup, primary, currentPointer, currentOldVersion, "Select old venue")}commit;`,
    );
    const lifecycle = await Promise.all([inactiveRace, selecting]);
    if (
      lifecycle.every((r) => r.code === 0) ||
      lifecycle.every((r) => r.code !== 0) ||
      !lifecycle.some(
        (r) =>
          r.stderr.includes("deadlock detected") ||
          r.stderr.includes("Local indisponível"),
      )
    )
      throw Error("Unexpected primary/archive contention result");
    if (
      sql(
        "select exists(select 1 from public.groups g join public.venues v on v.id=g.primary_venue_id where v.deleted_at is not null or v.group_id<>g.id);",
      ).stdout.trim() !== "f"
    )
      throw Error("Inactive or foreign primary persisted");
    console.log(
      "stage0042-L concurrency OK: archival/selection conflict aborts safely; no inactive principal",
    );
    if (process.env.STAGE0042L_GENERATE_TYPES === "1") {
      if (process.platform !== "linux" || process.arch !== "x64")
        throw Error("Local typegen currently requires Linux x64 native CLI");
      const require = createRequire(import.meta.url);
      const native = path.join(
        path.dirname(require.resolve("@supabase/cli-linux-x64/package.json")),
        "bin",
        "supabase",
      );
      docker(["cp", native, `${container}:/tmp/supabase`]);
      // Loopback INSIDE the network=none disposable container; no host ports,
      // network egress, real credentials, project ref or remote URL accepted.
      const generated = docker([
        "exec",
        "-e",
        "DO_NOT_TRACK=1",
        container,
        "timeout",
        "45",
        "/tmp/supabase",
        "gen",
        "types",
        "--db-url",
        "postgresql://postgres@127.0.0.1:5432/postgres?sslmode=disable",
        "--schema",
        "public",
      ]);
      if (!generated.stdout.includes("export type Database"))
        throw Error("Invalid local type generation");
      const directory = path.join(root, "src/types");
      mkdirSync(directory, { recursive: true });
      const destination = path.join(directory, "database.location.types.ts");
      const formatted = spawnSync(
        process.execPath,
        [
          path.join(
            path.dirname(require.resolve("prettier/package.json")),
            "bin",
            "prettier.cjs",
          ),
          "--parser",
          "typescript",
        ],
        {
          input:
            "// Generated officially by Supabase CLI from the disposable LOCAL public schema after stage0042-L validation. Do not edit manually. Application/remote Database types remain unchanged.\n" +
            generated.stdout,
          encoding: "utf8",
          maxBuffer: 8 * 1024 * 1024,
        },
      );
      if (formatted.status !== 0 || formatted.error)
        throw Error("Prettier failed on official generated types");
      writeFileSync(destination + ".tmp", formatted.stdout);
      renameSync(destination + ".tmp", destination);
      console.log(
        "stage0042-L official LOCAL types OK: src/types/database.location.types.ts (opt-in schema contract)",
      );
    }
  }
  if (memberMigration) {
    const proposed = readFileSync(path.join(root, "supabase/migrations", memberMigration), "utf8");
    const before = sql("select md5(pg_get_functiondef('private.set_member_status_impl(uuid,uuid,text)'::regprocedure));").stdout.trim();
    const rejected = docker(sqlArgs, "begin;" + proposed + ";do $begin raise exception 'foundation forced rollback';end$;commit;", true);
    if (rejected.status === 0 || !rejected.stderr.includes("foundation forced rollback"))
      throw Error("Expected DDL rollback");
    if (sql("select to_regclass('public.member_participation_periods') is null;").stdout.trim() !== "t" ||
        sql("select md5(pg_get_functiondef('private.set_member_status_impl(uuid,uuid,text)'::regprocedure));").stdout.trim() !== before)
      throw Error("Rollback changed schema or legacy RPC");
    sql("begin;" + proposed + ";commit;");
    const members = sql(readFileSync(path.join(root, "tests/database/member-foundation.sql"), "utf8"));
    console.log("members foundation OK: " + members.stderr.split("\n").filter(line => line.includes("NOTICE:") && line.includes("ok -")).length + " SQL assertions after legacy regressions");
    const owner = "00000000-0000-4000-8000-000000000001";
    const admin = "00000000-0000-4000-8000-000000000004";
    const session = actor => "begin;set session authorization authenticated;select set_config('request.jwt.claim.sub','" + actor + "',true);";
    sql(session(owner) + "select public.create_group('Synthetic members concurrency','members-foundation-race');commit;");
    const group = sql("select id from public.groups where slug='members-foundation-race';").stdout.trim();
    sql("begin;select set_config('request.jwt.claim.sub','" + owner + "',true);insert into public.group_members(group_id,player_id,role,status) select '" + group + "',id,case when user_id='" + admin + "' then 'admin' else 'player' end,'active' from public.players where user_id in ('00000000-0000-4000-8000-000000000003','" + admin + "');commit;");
    const target = sql("select m.id from public.group_members m join public.players p on p.id=m.player_id where m.group_id='" + group + "' and p.user_id='00000000-0000-4000-8000-000000000003';").stdout.trim();
    const adminMember = sql("select m.id from public.group_members m join public.players p on p.id=m.player_id where m.group_id='" + group + "' and p.user_id='" + admin + "';").stdout.trim();
    const demotion = sqlAsync(session(owner) + "select public.set_member_role('" + group + "','" + adminMember + "','player');select pg_sleep(0.5);commit;");
    await sleep(100);
    const stale = sqlAsync(session(admin) + "select public.set_member_status('" + group + "','" + target + "','suspended');commit;");
    const results = await Promise.all([demotion, stale]);
    if (results[0].code !== 0 || results[1].code === 0 || !results[1].stderr.includes("Permissão insuficiente"))
      throw Error("Demoted manager retained access");
    const one = sqlAsync(session(owner) + "select public.set_member_status('" + group + "','" + target + "','suspended');select pg_sleep(0.5);commit;");
    await sleep(100);
    const two = sqlAsync(session(owner) + "select public.set_member_status('" + group + "','" + target + "','suspended');commit;");
    if ((await Promise.all([one,two])).some(result => result.code !== 0))
      throw Error("Repeated concurrent inactivation failed");
    if (sql("select count(*)=1 and bool_and(ended_at is not null) from public.member_participation_periods where member_id='" + target + "';").stdout.trim() !== "t")
      throw Error("Concurrent inactivation duplicated or reopened a period");
    console.log("members foundation concurrency OK: demoted manager denied after lock; repeated inactivation closes exactly one period");
  }
} finally {
  docker(["rm", "--force", "--volumes", container], undefined, true);
}
