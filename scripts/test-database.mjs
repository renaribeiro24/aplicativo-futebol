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
