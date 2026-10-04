// build-data.mjs: fills assets/data/ for the app from the pipeline outputs. Reuses web/scripts/copy-data.mjs
// (same sources, same fixture fallback), copies its JSON files, and packs every lookup date into one
// lookups.json with a shared string table (~2 MB instead of 23 MB). No network, no API key.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MOBILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(MOBILE, "..");
const WEB_DATA = path.join(ROOT, "web", "public", "data");
const OUT = path.join(MOBILE, "assets", "data");

execFileSync(process.execPath, [path.join(ROOT, "web", "scripts", "copy-data.mjs")], { stdio: "inherit" });

const read = (name) => JSON.parse(fs.readFileSync(path.join(WEB_DATA, name), "utf8"));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const name of ["manifest.json", "addresses.json", "rules.json", "jurisdictions.json", "change_tests.json", "changes.json"]) {
  fs.copyFileSync(path.join(WEB_DATA, name), path.join(OUT, name));
}

// Explanations repeat across addresses (same rule x result x reason): store each string once.
// Packed item: [team_rule_id, result, conflict_flag 0/1, reason|null, explanation idx, explanation_es idx].
const strings = [];
const index = new Map();
const intern = (s) => {
  const v = s ?? "";
  if (!index.has(v)) {
    index.set(v, strings.length);
    strings.push(v);
  }
  return index.get(v);
};

const manifest = read("manifest.json");
const dates = {};
for (const asOf of manifest.lookup_dates) {
  const { lookups } = read(`lookups/${asOf}.json`);
  dates[asOf] = {};
  for (const [id, items] of Object.entries(lookups)) {
    dates[asOf][id] = items.map((i) => [i.team_rule_id, i.result, i.conflict_flag ? 1 : 0, i.reason ?? null, intern(i.explanation), intern(i.explanation_es ?? i.explanation)]);
  }
}
fs.writeFileSync(path.join(OUT, "lookups.json"), JSON.stringify({ strings, dates }));

const mb = (fs.statSync(path.join(OUT, "lookups.json")).size / 1e6).toFixed(2);
console.log(`build-data: wrote mobile/assets/data/ (lookup dates: ${Object.keys(dates).join(", ") || "none"}; lookups.json ${mb} MB, ${strings.length} strings)`);
