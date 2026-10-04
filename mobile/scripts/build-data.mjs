// build-data.mjs: fills assets/data/ for the app from the pipeline outputs. Reuses web/scripts/copy-data.mjs
// (same sources, same fixture fallback), copies its JSON files, and packs every lookup date into one
// lookups.json with a shared string table (~2 MB instead of 23 MB), plus approximate map points (geo.json).
// No network, no API key.

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
// Write in place, only when content changed. Deleting and recreating the folder Metro watches can make it
// miss the change and keep serving a stale module (seen: changes.json bundled as {} after the pipeline ran).
fs.mkdirSync(OUT, { recursive: true });
const writeIfChanged = (name, content) => {
  const file = path.join(OUT, name);
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) return;
  fs.writeFileSync(file, content);
};
const FILES = ["manifest.json", "addresses.json", "rules.json", "jurisdictions.json", "change_tests.json", "changes.json"];
for (const name of FILES) writeIfChanged(name, fs.readFileSync(path.join(WEB_DATA, name), "utf8"));
for (const name of fs.readdirSync(OUT)) if (![...FILES, "lookups.json", "geo.json"].includes(name)) fs.rmSync(path.join(OUT, name));

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
writeIfChanged("lookups.json", JSON.stringify({ strings, dates }));

// Approximate map points from the Census geocoder responses already in derived/census (no network).
// Rounded to 3 decimals (~100 m): the app shows an approximate location, never a rooftop. Addresses the geocoder
// missed get the centroid of their jurisdiction's matched points, marked "area".
const CENSUS = path.join(ROOT, "derived", "census");
const parseCsvLine = (line) => [...line.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
const points = {};
for (const file of ["batch.csv", "batch_nozip.csv"]) {
  const f = path.join(CENSUS, file);
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const [id, , match, , , lonlat] = parseCsvLine(line);
    if (!id || match !== "Match" || !lonlat || points[id]) continue;
    const [lon, lat] = lonlat.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lon)) points[id] = [lat, lon];
  }
}
const jur = read("jurisdictions.json");
const byJur = {};
for (const [id, [lat, lon]] of Object.entries(points)) {
  const j = jur[id]?.jurisdiction;
  if (j) (byJur[j] ??= []).push([lat, lon]);
}
const r3 = (v) => Math.round(v * 1000) / 1000;
const geo = {};
for (const id of Object.keys(jur)) {
  if (points[id]) geo[id] = [r3(points[id][0]), r3(points[id][1]), "street"];
  else {
    const pts = byJur[jur[id]?.jurisdiction];
    if (pts?.length) geo[id] = [r3(pts.reduce((a, p) => a + p[0], 0) / pts.length), r3(pts.reduce((a, p) => a + p[1], 0) / pts.length), "area"];
  }
}
writeIfChanged("geo.json", JSON.stringify(geo));
console.log(`build-data: geo.json ${Object.values(geo).filter((g) => g[2] === "street").length} street-level, ${Object.values(geo).filter((g) => g[2] === "area").length} area-level, ${Object.keys(jur).length - Object.keys(geo).length} without location`);

const mb = (fs.statSync(path.join(OUT, "lookups.json")).size / 1e6).toFixed(2);
console.log(`build-data: wrote mobile/assets/data/ (lookup dates: ${Object.keys(dates).join(", ") || "none"}; lookups.json ${mb} MB, ${strings.length} strings)`);
