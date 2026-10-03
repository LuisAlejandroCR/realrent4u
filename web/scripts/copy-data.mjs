// copy-data.mjs: copies the pipeline outputs (submission/, derived/, sample addresses, docs/METHOD.md) into public/data/.
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

// Method note: docs/METHOD.md, rendered to HTML by /method at build time. Optional: the page shows a
// "not published yet" state while the file is missing or empty.
{
  const src = path.join(ROOT, "docs", "METHOD.md");
  const text = fs.existsSync(src) ? fs.readFileSync(src, "utf8") : "";
  if (text.trim()) fs.writeFileSync(path.join(OUT, "METHOD.md"), text);
  else manifest.warnings.push("docs/METHOD.md is not published yet; /method shows a placeholder.");
  manifest.sources.method_note = { kind: text.trim() ? "docs" : "missing", path: rel(src) };
}

const dd = demoDates();
manifest.demo_dates = dd.dates;
manifest.default_as_of = dd.def;
manifest.uses_fixtures = Object.values(manifest.sources).some((s) => s.kind === "fixture");
writeJson("manifest.json", manifest);

console.log(`copy-data: wrote ${rel(OUT)}/ (fixtures: ${manifest.uses_fixtures}, lookup dates: ${manifest.lookup_dates.join(", ") || "none"})`);
for (const w of manifest.warnings) console.log(`copy-data: ${w}`);
