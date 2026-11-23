import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
const directory = "supabase/migrations";
const source = readFileSync("supabase/proposals/member_foundation.sql", "utf8");
const existing = readdirSync(directory).filter((name) =>
  name.endsWith("_member_foundation.sql"),
);
if (existing.length > 1) throw new Error("Duplicate migration");
let name = existing[0];
if (!name) {
  const env = { ...process.env, DO_NOT_TRACK: "1" };
  execFileSync("node_modules/.bin/supabase", ["migration", "new", "--help"], {
    stdio: "inherit",
    env,
  });
  execFileSync(
    "node_modules/.bin/supabase",
    ["migration", "new", "member_foundation"],
    { stdio: "inherit", env },
  );
  name = readdirSync(directory).find((value) =>
    value.endsWith("_member_foundation.sql"),
  );
  if (!name || !/^[0-9]{14}_member_foundation[.]sql$/.test(name))
    throw new Error("Missing CLI migration output");
  writeFileSync(directory + "/" + name, source);
} else if (readFileSync(directory + "/" + name, "utf8") !== source) {
  throw new Error("Migration differs from reviewed proposal");
}
mkdirSync("work/member-foundation", { recursive: true });
writeFileSync("work/member-foundation/" + name, source);
console.log("PREPARED_MIGRATION_FILE " + name);
