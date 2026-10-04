// landing-media.mjs: reads web/landing.config.json (videos, demo link) and writes public/data/landing.json
// plus one QR SVG per real destination in public/data/qr/. Local files must exist under web/public/;
// a missing file or a null/non-https destination stays "pending": no QR, no video is ever invented.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WEB, "public");
const OUT = path.join(PUBLIC, "data");
const warnings = [];
let qrcode = null;

try {
  qrcode = (await import("qrcode-generator")).default;
} catch (e) {
  warnings.push(`qrcode-generator unavailable (${e.code ?? e.message}); QR images shown as pending`);
}

const isHttps = (v) => typeof v === "string" && /^https:\/\/\S+$/.test(v);

// A resource is either an https URL or a path relative to web/public/ that exists on disk.
function resource(v, what) {
  if (v == null || v === "") return null;
  if (isHttps(v)) return v;
  const clean = String(v).replace(/^\/+/, "");
  if (fs.existsSync(path.join(PUBLIC, clean))) return `/${clean}`;
  warnings.push(`${what}: ${v} not found under web/public/ (shown as pending)`);
  return null;
}

function qr(id, target) {
  if (!isHttps(target)) return null;
  if (!qrcode) return null;
  const code = qrcode(0, "M");
  code.addData(target);
  code.make();
  // 4-module quiet zone, black on white, scalable.
  const svg = code.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
  fs.mkdirSync(path.join(OUT, "qr"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "qr", `${id}.svg`), svg);
  return `/data/qr/${id}.svg`;
}

const cfgPath = path.join(WEB, "landing.config.json");
let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
} catch (e) {
  warnings.push(`landing.config.json unreadable (${e.message}); every video and QR shown as pending`);
}
const site = isHttps(cfg.site_url) ? cfg.site_url.replace(/\/+$/, "") : null;
fs.rmSync(path.join(OUT, "qr"), { recursive: true, force: true });

const videos = (cfg.videos ?? []).map((v) => {
  const src = resource(v.src, `${v.id}.src`);
  const page = isHttps(v.url) ? v.url : null;
  const target = page ?? (src && src.startsWith("/") && site ? `${site}${src}` : isHttps(src) ? src : null);
  return {
    id: v.id,
    title: v.title ?? { en: v.id, es: v.id },
    context: { en: v.context?.en ?? null, es: v.context?.es ?? null },
    optional: v.optional === true,
    src,
    url: page,
    poster: resource(v.poster, `${v.id}.poster`),
    duration: typeof v.duration === "string" && v.duration.trim() ? v.duration.trim() : null,
    captions: { en: resource(v.captions?.en, `${v.id}.captions.en`), es: resource(v.captions?.es, `${v.id}.captions.es`) },
    transcript: { en: resource(v.transcript?.en, `${v.id}.transcript.en`), es: resource(v.transcript?.es, `${v.id}.transcript.es`) },
    qr_target: target,
    qr: qr(v.id, target),
  };
});

const demoTarget = isHttps(cfg.demo?.url) ? cfg.demo.url : site ? `${site}/dashboard/` : null;
const downloads = (cfg.downloads ?? []).map((item) => ({
  id: item.id,
  eyebrow: item.eyebrow ?? { en: item.id, es: item.id },
  title: item.title ?? { en: item.id, es: item.id },
  description: item.description ?? { en: null, es: null },
  url: isHttps(item.url) ? item.url : null,
  qr: qr(`download-${item.id}`, isHttps(item.url) ? item.url : null),
}));
const landing = { site_url: site, demo: { url: demoTarget, qr: qr("demo", demoTarget) }, downloads, videos, warnings };
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "landing.json"), JSON.stringify(landing));

const ready = videos.filter((v) => v.src || v.url).length;
console.log(`landing-media: ${ready}/${videos.length} videos configured, demo link ${demoTarget ? "set" : "pending"}`);
for (const w of warnings) console.log(`landing-media: ${w}`);
