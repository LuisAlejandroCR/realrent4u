// capture-stills.mjs: full screenshots of the landing's How it works sections (no cropping), at 2× for sharpness,
// plus the box of the part each technical-video card magnifies. Run from web/: node scripts/videos/capture-stills.mjs
// [baseUrl]. Output: ../media/scenes/<name>.png and stills.json (box in image pixels).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OUT = path.join(ROOT, "media", "scenes");
const BASE = process.argv[2] ?? "https://realrent4u.vercel.app";
const STILLS = [
  { name: "how_steps", section: "section#how", focus: ".rr-steps3" },
  { name: "how_results", section: "section:has(.rr-l-states)", focus: ".rr-l-states" },
];

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
await page.goto(`${BASE}/?lang=en`, { waitUntil: "networkidle" });
await page.addStyleTag({ content: "nextjs-portal{display:none!important}.rr-header{position:static!important}" });
const meta = {};
for (const s of STILLS) {
  const sec = page.locator(s.section).first();
  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const a = await sec.boundingBox();
  const f = await page.locator(s.focus).first().boundingBox();
  const file = path.join(OUT, `${s.name}.png`);
  await sec.screenshot({ path: file });
  meta[s.name] = { file, focus: [f.x - a.x, f.y - a.y, f.width, f.height].map((v) => Math.round(v * 2)) };
  console.log(s.name, meta[s.name].focus);
}
await browser.close();
fs.writeFileSync(path.join(OUT, "stills.json"), JSON.stringify(meta, null, 1));
