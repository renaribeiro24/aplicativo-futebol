import {execFileSync} from "node:child_process";
import {readdirSync,readFileSync,writeFileSync} from "node:fs";
execFileSync("node_modules/.bin/supabase",["migration","new","--help"],{stdio:"inherit"});
execFileSync("node_modules/.bin/supabase",["migration","new","member_management"],{stdio:"inherit"});
const file=readdirSync("supabase/migrations").filter(n=>n.endsWith("_member_management.sql")).sort().at(-1);
if(!file)throw Error("CLI migration missing");
writeFileSync("supabase/migrations/"+file,readFileSync("supabase/proposals/member_management.sql"));
console.log("PREPARED_MIGRATION_FILE "+file);
