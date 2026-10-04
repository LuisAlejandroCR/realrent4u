// copy-data.mjs: copies the pipeline outputs (submission/, derived/, sample addresses) into public/data/.
// Falls back to tests/fixtures/ when an output is missing or still empty, and writes manifest.json
// recording which source each file came from so the UI can show a "fixture data" badge.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(WEB, "..");
const OUT = path.join(WEB, "public", "data");

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(name, value) {
  const p = path.join(OUT, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value));
}

// Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function demoDates() {
  const fallback = {
    dates: ["2025-12-31", "2026-01-02", "2026-10-01", "2027-07-02"],
    def: "2026-10-01",
  };
  try {
    const src = fs.readFileSync(path.join(ROOT, "realrent", "paths.py"), "utf8");
    const dates = [...(src.match(/DEMO_DATES\s*=\s*\[([^\]]*)\]/)?.[1] ?? "").matchAll(/"(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
    const def = src.match(/DEFAULT_AS_OF\s*=\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
    return { dates: dates.length ? dates : fallback.dates, def: def ?? fallback.def, from: "realrent/paths.py" };
  } catch {
    return { ...fallback, from: "built-in default" };
  }
}

const countItems = (lk) => Object.values(lk?.lookups ?? {}).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
const realKeys = (obj) => Object.keys(obj ?? {}).filter((k) => !k.startsWith("_"));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const manifest = { generated_at: new Date().toISOString(), uses_fixtures: false, sources: {}, lookup_dates: [], warnings: [] };

// Rules: submission/rules.json, else fixture.
{
  const sub = path.join(ROOT, "submission", "rules.json");
  const fx = path.join(ROOT, "tests", "fixtures", "rules.json");
  let data = readJson(sub);
  let src = sub;
  let kind = "submission";
  if (!data?.rules?.length) {
    data = readJson(fx) ?? { rules: [] };
    src = fx;
    kind = data.rules.length ? "fixture" : "missing";
    manifest.warnings.push("submission/rules.json is missing or empty; using test fixtures.");
  }
  writeJson("rules.json", { rules: data.rules ?? [] });
  manifest.sources.rules = { kind, path: rel(src), count: (data.rules ?? []).length };
}

// Jurisdictions: derived/jurisdictions.json, else fixture.
{
  const der = path.join(ROOT, "derived", "jurisdictions.json");
  const fx = path.join(ROOT, "tests", "fixtures", "jurisdictions.json");
  let data = readJson(der);
  let src = der;
  let kind = "derived";
  if (!realKeys(data).length) {
    data = readJson(fx) ?? {};
    src = fx;
    kind = realKeys(data).length ? "fixture" : "missing";
    manifest.warnings.push("derived/jurisdictions.json is missing or empty; using test fixtures (11 addresses).");
  }
  const clean = Object.fromEntries(realKeys(data).map((k) => [k, data[k]]));
  writeJson("jurisdictions.json", clean);
  manifest.sources.jurisdictions = { kind, path: rel(src), count: realKeys(clean).length };
}

// Lookups: derived/lookups/<as_of>.json, plus submission/lookups.json for its own date.
{
  const files = [];
  const dir = path.join(ROOT, "derived", "lookups");
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) files.push(path.join(dir, f));
  }
  files.push(path.join(ROOT, "submission", "lookups.json"));
  const used = [];
  for (const f of files) {
    const data = readJson(f);
    const asOf = data?.as_of ?? path.basename(f, ".json");
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || countItems(data) === 0) continue;
    if (manifest.lookup_dates.includes(asOf)) continue;
    writeJson(`lookups/${asOf}.json`, { as_of: asOf, lookups: data.lookups });
    manifest.lookup_dates.push(asOf);
    used.push({ as_of: asOf, path: rel(f), items: countItems(data) });
  }
  manifest.lookup_dates.sort();
  manifest.sources.lookups = { kind: used.length ? "derived" : "missing", files: used };
  if (!used.length) manifest.warnings.push("No lookup results yet (submission/lookups.json is empty and derived/lookups/ is missing).");
}

// Changes: submission/changes.json if it holds any result.
{
  const sub = path.join(ROOT, "submission", "changes.json");
  const data = readJson(sub);
  const filled = data && Object.values(data).some((t) => (t?.affected_address_ids?.length ?? 0) > 0 || (t?.conflict_flag_address_ids?.length ?? 0) > 0 || (t?.notes ?? "").trim());
  writeJson("changes.json", filled ? data : {});
  manifest.sources.changes = { kind: filled ? "submission" : "missing", path: rel(sub) };
  if (!filled) manifest.warnings.push("submission/changes.json has no results yet.");
  const tests = readJson(path.join(ROOT, "data", "dev", "change_tests.json")) ?? [];
  writeJson("change_tests.json", tests);
  manifest.sources.change_tests = { kind: "starter_pack", path: "data/dev/change_tests.json", count: tests.length };
}

// Addresses: CSV copied verbatim plus a parsed JSON for the UI.
{
  const csv = path.join(ROOT, "data", "data", "sample_addresses.csv");
  const text = fs.existsSync(csv) ? fs.readFileSync(csv, "utf8") : "";
  if (text) fs.copyFileSync(csv, path.join(OUT, "sample_addresses.csv"));
  const rows = text ? parseCsv(text) : [];
  writeJson("addresses.json", rows);
  manifest.sources.addresses = { kind: text ? "starter_pack" : "missing", path: rel(csv), count: rows.length };
}

// Corpus manifest: retrieval date and URL per source document.
{
  const csv = path.join(ROOT, "data", "corpus", "corpus_manifest.csv");
  const rows = fs.existsSync(csv) ? parseCsv(fs.readFileSync(csv, "utf8")) : [];
  const corpus = Object.fromEntries(
    rows.map((r) => [r.doc_id, { url: r.url, retrieved_at: r.retrieved_at || null, capture: r.capture, source_type: r.source_type, jurisdictions: r.jurisdictions }]),
  );
  writeJson("corpus.json", corpus);
  manifest.sources.corpus = { kind: rows.length ? "starter_pack" : "missing", path: rel(csv), count: rows.length };
}

// Landing hero: three real addresses across every lookup date, small enough for the first paint
// (the full lookups are ~6 MB per date). Picked by predicate, never by id:
//   dates  — the result mix changes most across dates (prefers one with a superseded state rule);
//   review — carries conflict flags and an unknown result;
//   postal — the postal city differs from the legal place.
{
  const rules = readJson(path.join(OUT, "rules.json"))?.rules ?? [];
  const jur = readJson(path.join(OUT, "jurisdictions.json")) ?? {};
  const addrs = readJson(path.join(OUT, "addresses.json")) ?? [];
  const dates = manifest.lookup_dates;
  const lk = Object.fromEntries(dates.map((d) => [d, readJson(path.join(OUT, "lookups", `${d}.json`))?.lookups ?? {}]));
  const hero = { dates, addresses: [], rules: {} };
  if (dates.length) {
    const sig = (id) => dates.map((d) => (lk[d][id] ?? []).map((i) => `${i.team_rule_id}:${i.result}`).sort().join("|"));
    const changes = (id) => new Set(sig(id)).size - 1;
    const has = (id, f) => dates.some((d) => (lk[d][id] ?? []).some(f));
    const cands = addrs.filter((a) => jur[a.address_id]?.jurisdiction && (lk[dates[0]][a.address_id] ?? []).length);
    const used = new Set();
    const best = (score) => {
      const list = cands.filter((a) => !used.has(jur[a.address_id].jurisdiction)).map((a) => [score(a), a]).filter(([s]) => s > 0);
      list.sort((x, y) => y[0] - x[0]);
      const a = list[0]?.[1];
      if (a) used.add(jur[a.address_id].jurisdiction);
      return a;
    };
    const picks = [
      ["dates", best((a) => changes(a.address_id) * 10 + (has(a.address_id, (i) => i.result === "superseded") ? 5 : 0))],
      ["review", best((a) => (has(a.address_id, (i) => i.conflict_flag) && has(a.address_id, (i) => i.result === "unknown") ? 1 + changes(a.address_id) : 0))],
      ["postal", best((a) => {
        const j = jur[a.address_id];
        return j.place && j.place.toLowerCase() !== a.postal_city.toLowerCase() ? 1 : 0;
      })],
    ].filter(([, a]) => a);
    const byId = new Map(rules.map((r) => [r.team_rule_id, r]));
    for (const [kind, a] of picks) {
      const j = jur[a.address_id];
      const results = Object.fromEntries(
        dates.map((d) => [d, (lk[d][a.address_id] ?? []).map((i) => ({ id: i.team_rule_id, r: i.result, c: !!i.conflict_flag }))]),
      );
      for (const d of dates) for (const i of results[d]) {
        const r = byId.get(i.id);
        if (r && !hero.rules[i.id]) hero.rules[i.id] = { title: r.title, level: r.level, jurisdiction: r.jurisdiction, category: r.category };
      }
      // One quoted, sourced rule that applies on the default date, local first: the evidence line.
      const ev = (results[dd0()] ?? results[dates[0]])
        .filter((i) => i.r === "applies")
        .map((i) => byId.get(i.id))
        .filter((r) => r?.quoted_span && r.source_url)
        .sort((x, y) => Number(y.level !== "state") - Number(x.level !== "state"))[0];
      hero.addresses.push({
        kind,
        address_id: a.address_id,
        street: a.street_address,
        postal_city: a.postal_city,
        state: a.state,
        zip: a.zip,
        year_built: a.year_built || null,
        units: a.units || null,
        jurisdiction: j.jurisdiction,
        county: j.county ?? null,
        place: j.place ?? null,
        results,
        evidence: ev ? { id: ev.team_rule_id, quote: ev.quoted_span.length > 150 ? `${ev.quoted_span.slice(0, 150).trimEnd()}…` : ev.quoted_span, citation: ev.citation, url: ev.source_url, retrieved_at: ev.retrieved_at ?? null } : null,
      });
    }
  }
  writeJson("hero.json", hero);
  console.log(`copy-data: hero.json with ${hero.addresses.map((a) => `${a.kind}=${a.address_id}`).join(", ") || "no addresses"}`);
}

function dd0() {
  return demoDates().def;
}

const dd = demoDates();
manifest.demo_dates = dd.dates;
manifest.default_as_of = dd.def;
manifest.uses_fixtures = Object.values(manifest.sources).some((s) => s.kind === "fixture");
writeJson("manifest.json", manifest);

console.log(`copy-data: wrote ${rel(OUT)}/ (fixtures: ${manifest.uses_fixtures}, lookup dates: ${manifest.lookup_dates.join(", ") || "none"})`);
for (const w of manifest.warnings) console.log(`copy-data: ${w}`);
