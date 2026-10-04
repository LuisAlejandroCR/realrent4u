// record-scenes.mjs: records the product-demo screen scenes from the live site with Playwright (1920×1080),
// one short video per narration beat (1280×720), and writes scenes.json with where each recording becomes "ready".
// Run from web/: node scripts/videos/record-scenes.mjs [baseUrl] [scene ...]. Output: ../media/scenes/ (gitignored).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OUT = path.join(ROOT, "media", "scenes");
const BASE = process.argv[2] ?? "https://realrent4u.vercel.app";
// Recorded at 1280×720 and scaled to 1080p when edited, so page text reads 1.5× larger in the video.
const SIZE = { width: 1280, height: 720 };
fs.mkdirSync(OUT, { recursive: true });

const center = (p, sel) => p.locator(sel).first().evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));

// name, url, seconds to record after ready, actions run after ready (times in ms from ready).
const SCENES = [
  { name: "hero", url: "/?lang=en", secs: 9 },
  { name: "map", url: "/dashboard/?lang=en&asOf=2026-10-01&a=A0036", secs: 6.5, act: async (p) => center(p, ".rr-where") },
  {
    name: "sf", url: "/dashboard/?lang=en&asOf=2026-10-01&a=A0016", secs: 8.5,
    act: async (p) => {
      const card = p.locator("article:has(.rr-displaced)").first();
      await card.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
      await p.waitForTimeout(2400);
      await card.locator(".rr-displaced summary").click();
      await p.waitForTimeout(400);
      await card.locator(".rr-displaced").evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
    },
  },
  { name: "quote", url: "/dashboard/?lang=en&asOf=2026-10-01&a=A0016", secs: 5.5, act: async (p) => center(p, "article .rr-quote") },
  { name: "berkeley", url: "/dashboard/?lang=en&asOf=2026-10-01&a=A0005", secs: 6.5, act: async (p) => p.locator("article:has(#h-r-D006-01)").evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" })) },
  {
    name: "hoboken", url: "/dashboard/?lang=en&asOf=2026-10-01&a=A0002", secs: 7.5,
    act: async (p) => {
      await center(p, ".rr-dchart");
      await p.waitForTimeout(2200);
      await p.locator(".rr-dchart-rows button").last().click();
      await p.waitForTimeout(900);
      await p.locator("article:has(#h-r-D069-01)").evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
    },
  },
  // Technical walkthrough: the landing's How it works sections (the rest comes from the iPhone recording).
  { name: "how_steps", url: "/?lang=en", secs: 7, act: async (p) => center(p, ".rr-steps3") },
  { name: "how_results", url: "/?lang=en", secs: 7, act: async (p) => center(p, ".rr-l-states") },
  { name: "m_kpis", url: "/dashboard/?lang=en&tab=method", secs: 6 },
  { name: "m_pipe", url: "/dashboard/?lang=en&tab=method", secs: 7.5, act: async (p) => center(p, ".rr-pipe") },
  { name: "m_bars", url: "/dashboard/?lang=en&tab=method", secs: 7.5, act: async (p) => center(p, ".rr-bars") },
  { name: "m_maps", url: "/dashboard/?lang=en&tab=method", secs: 7.5, act: async (p) => center(p, ".rr-mapgrid") },
  { name: "t3", url: "/dashboard/?lang=en&tab=tests&t=T3", secs: 7.5, act: async (p) => center(p, "#test-T3 .rr-test-vis") },
  { name: "m_files", url: "/dashboard/?lang=en&tab=method", secs: 6, act: async (p) => center(p, ".rr-table") },
  { name: "spanish", url: "/dashboard/?lang=es&asOf=2026-10-01&a=A0016", secs: 4.5, act: async (p) => center(p, "article .rr-rule-foot") },
];

const browser = await chromium.launch({ channel: "msedge" });
const meta = {};
const only = process.argv.slice(3);
const prev = fs.existsSync(path.join(OUT, "scenes.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "scenes.json"), "utf8")) : {};
Object.assign(meta, prev);
for (const s of SCENES.filter((x) => !only.length || only.includes(x.name))) {
  const ctx = await browser.newContext({ viewport: SIZE, recordVideo: { dir: OUT, size: SIZE } });
  const t0 = Date.now();
  const page = await ctx.newPage();
  await page.goto(BASE + s.url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.waitForTimeout(800);
  const ready = (Date.now() - t0) / 1000;
  if (s.act) s.act(page).catch((e) => console.error(s.name, e.message));
  await page.waitForTimeout(s.secs * 1000 + 300);
  const video = page.video();
  await ctx.close();
  const file = path.join(OUT, `${s.name}.webm`);
  fs.renameSync(await video.path(), file);
  meta[s.name] = { file, ready, secs: s.secs };
  console.log(`${s.name}: ready at ${ready.toFixed(2)} s`);
}
await browser.close();
fs.writeFileSync(path.join(OUT, "scenes.json"), JSON.stringify(meta, null, 1));
