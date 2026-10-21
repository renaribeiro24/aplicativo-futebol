import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
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
  for (const name of migrations) {
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
} finally {
  docker(["rm", "--force", "--volumes", container], undefined, true);
}
