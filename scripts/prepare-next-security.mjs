import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
const before=JSON.parse(readFileSync("package-lock.json","utf8"));
execFileSync("npm",["install","--package-lock-only","--ignore-scripts","--save-exact","next@16.4.6","eslint-config-next@16.4.6"],{stdio:"inherit"});
const after=JSON.parse(readFileSync("package-lock.json","utf8"));const changed={};const deleted=[];
for(const [key,value] of Object.entries(after.packages)){if(JSON.stringify(before.packages[key])!==JSON.stringify(value))changed[key]=value;}
for(const key of Object.keys(before.packages))if(!(key in after.packages))deleted.push(key);
console.log("NEXT_LOCK_PATCH "+JSON.stringify({package:JSON.parse(readFileSync("package.json","utf8")),changed,deleted}));
execFileSync("npm",["ci"],{stdio:"inherit"});
