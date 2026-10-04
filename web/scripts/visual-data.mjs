// visual-data.mjs: precomputes the map and chart data the dashboard draws, so nothing is geocoded or projected
// in the browser and no map tiles are fetched. Writes public/data/geo.json (metro maps: county outlines from
// us-atlas, sample addresses rounded to ~1 km) and public/data/address-dates.json (result counts per date).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoBounds, geoMercator, geoPath, geoDistance } from "d3-geo";
import { feature } from "topojson-client";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(WEB, "..");
const OUT = path.join(WEB, "public", "data");
const read = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};
const W = 320;
const H = 240;
const PAD = 18;
const CLUSTER_KM = 30;
const EARTH_KM = 6371;
const ORDER = ["applies", "unknown", "superseded", "not_yet_effective", "pending"];

// Census batch output: id, input, Match/No_Match/Tie, Exact/Non_Exact, matched address, "lon,lat", ...
function censusPoints() {
  const out = {};
  for (const f of ["batch.csv", "batch_nozip.csv"]) {
    const p = path.join(ROOT, "derived", "census", f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const cells = [...line.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
      if (cells[2] !== "Match" || !cells[5]) continue;
      const [lon, lat] = cells[5].split(",").map(Number);
      // Rounded to two decimals (~1 km): the map shows an approximate location, never the parcel.
      if (Number.isFinite(lon) && Number.isFinite(lat)) out[cells[0]] = { lon: +lon.toFixed(2), lat: +lat.toFixed(2), exact: cells[3] === "Exact" };
    }
  }
  return out;
}

const jur = read(path.join(OUT, "jurisdictions.json")) ?? {};
const addresses = read(path.join(OUT, "addresses.json")) ?? [];
const pts = censusPoints();
const atlas = read(path.join(WEB, "node_modules", "us-atlas", "counties-10m.json"));
const geo = { metros: [], points: {}, unplaced: [] };

if (atlas && Object.keys(pts).length) {
  const counties = feature(atlas, atlas.objects.counties).features;
  const states = feature(atlas, atlas.objects.states).features;
  const fips = new Map(states.map((s) => [s.properties.name, s.id]));
  const STATE_NAME = { CA: "California", MA: "Massachusetts", NJ: "New Jersey", NY: "New York" };

  // Jurisdiction centroids, then greedy clustering of nearby jurisdictions into one metro view.
  const byJur = new Map();
  for (const a of addresses) {
    const j = jur[a.address_id]?.jurisdiction;
    const p = pts[a.address_id];
    if (!j) continue;
    if (!byJur.has(j)) byJur.set(j, { j, state: jur[a.address_id].state, place: jur[a.address_id].place ?? j.split(",")[0], ids: [], n: 0 });
    const g = byJur.get(j);
    g.n++;
    if (p) g.ids.push(a.address_id);
    else geo.unplaced.push(a.address_id);
  }
  const centroid = (ids) => [ids.reduce((s, i) => s + pts[i].lon, 0) / ids.length, ids.reduce((s, i) => s + pts[i].lat, 0) / ids.length];
  const clusters = [];
  for (const g of [...byJur.values()].filter((g) => g.ids.length).sort((x, y) => y.n - x.n)) {
    g.c = centroid(g.ids);
    const c = clusters.find((k) => k.members.some((m) => geoDistance(m.c, g.c) * EARTH_KM < CLUSTER_KM));
    if (c) c.members.push(g);
    else clusters.push({ members: [g] });
  }

  for (const [ci, c] of clusters.entries()) {
    const ids = c.members.flatMap((m) => m.ids);
    const mp = { type: "MultiPoint", coordinates: ids.map((i) => [pts[i].lon, pts[i].lat]) };
    const proj = geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], mp);
    const pathOf = geoPath(proj).digits(1);
    // County outlines whose bounds touch the view (with margin) give the place its shape and water edges.
    const [[x0, y0], [x1, y1]] = geoBounds(mp);
    const mx = (x1 - x0) * 0.6 + 0.05;
    const my = (y1 - y0) * 0.6 + 0.05;
    const stateIds = new Set(c.members.map((m) => fips.get(STATE_NAME[m.state])).filter(Boolean));
    const near = counties.filter((f) => {
      const [[a0, b0], [a1, b1]] = geoBounds(f);
      return a1 >= x0 - mx && a0 <= x1 + mx && b1 >= y0 - my && b0 <= y1 + my;
    });
    // One kilometre in view units, measured at the cluster centre, for the scale bar.
    const [cx, cy] = centroid(ids);
    const p0 = proj([cx, cy]);
    const p1 = proj([cx + 1 / (111.32 * Math.cos((cy * Math.PI) / 180)), cy]);
    const kmPx = Math.abs(p1[0] - p0[0]);
    const barKm = [1, 2, 5, 10, 20, 50].find((k) => k * kmPx >= 40) ?? 50;
    const id = `m${ci}`;
    geo.metros.push({
      id,
      name: c.members.map((m) => m.place).join(" · "),
      state: c.members[0].state,
      w: W,
      h: H,
      counties: near.map((f) => ({
        name: f.properties.name,
        home: stateIds.has(String(f.id).slice(0, 2)),
        d: pathOf(f),
      })).filter((x) => x.d),
      places: c.members.map((m) => {
        const [x, y] = proj(m.c);
        return { jurisdiction: m.j, name: m.place, n: m.n, x: +x.toFixed(1), y: +y.toFixed(1) };
      }),
      scale: { km: barKm, px: +(barKm * kmPx).toFixed(1) },
    });
    for (const i of ids) {
      const [x, y] = proj([pts[i].lon, pts[i].lat]);
      geo.points[i] = { m: id, x: +x.toFixed(1), y: +y.toFixed(1), e: pts[i].exact ? 1 : 0 };
    }
  }
}
fs.writeFileSync(path.join(OUT, "geo.json"), JSON.stringify(geo));

// Result counts per address and date, in ORDER, for the "results across dates" chart.
const manifest = read(path.join(OUT, "manifest.json"));
const dates = manifest?.lookup_dates ?? [];
const counts = { order: ORDER, dates, by: {} };
for (const d of dates) {
  const lk = read(path.join(OUT, "lookups", `${d}.json`))?.lookups ?? {};
  for (const [id, items] of Object.entries(lk)) {
    const row = ORDER.map((k) => items.filter((i) => i.result === k).length);
    row.push(items.filter((i) => i.conflict_flag).length);
    (counts.by[id] ??= []).push(row);
  }
}
fs.writeFileSync(path.join(OUT, "address-dates.json"), JSON.stringify(counts));

const kb = (f) => Math.round(fs.statSync(path.join(OUT, f)).size / 1024);
console.log(
  `visual-data: ${geo.metros.length} metro maps (${geo.metros.map((m) => m.name).join(" | ")}), ` +
    `${Object.keys(geo.points).length} placed, ${geo.unplaced.length} unplaced; geo.json ${kb("geo.json")} KB, address-dates.json ${kb("address-dates.json")} KB`,
);
