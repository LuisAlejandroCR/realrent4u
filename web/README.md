<!--
web/README.md: cómo correr, compilar y desplegar en Vercel la demo web estática (Next.js) y de dónde lee sus datos.
Se distingue del README.md raíz (pipeline Python y entrega) y de docs/PLAN.md (plan de trabajo en paralelo).
Aviso: la demo no es asesoría legal; solo muestra JSON precalculado.
-->

# Web demo — Rental Housing Law Navigator

Static Next.js app (App Router, `output: "export"`). It reads precomputed JSON. It has no server, needs no API key and makes no model call at runtime.

## Run

```bash
cd web
npm install
npm run dev      # copies data, then http://localhost:3000
npm run build    # copies data, then static site in web/out/
npm run serve    # serve web/out/ on :3000
```

Routes: `/` is the landing page and `/dashboard` is the app, with three tabs: address lookup, change tests and method & audit. `/search`, `/changes` and `/about` open the dashboard on the matching tab.

URL params: `?lang=es&asOf=2027-07-02&tab=lookup&a=A0016`. `tab=tests&t=T3` opens one change test. Its **Run test** button recomputes the test in the browser from the precomputed lookups and checks the result against `changes.json`.

Code: the UI lives in `rr/` (views, components, `data.ts`, `i18n.ts`, `rr.css` + `rr-landing.css`); `app/` only holds the route files.

## Data

`scripts/copy-data.mjs` runs before `dev` and `build`. It writes the following to `public/data/`, which is generated and gitignored:

| Output | Source | Fallback when missing or empty |
|---|---|---|
| `rules.json` | `submission/rules.json` | `tests/fixtures/rules.json` |
| `jurisdictions.json` | `derived/jurisdictions.json` | `tests/fixtures/jurisdictions.json` |
| `lookups/<as_of>.json` | `derived/lookups/*.json` plus `submission/lookups.json` | none: the UI says "no lookup data yet" and lists the rules on file without evaluating them |
| `changes.json` | `submission/changes.json` | none: the UI says there are no results yet |
| `change_tests.json` | `data/dev/change_tests.json` | — |
| `addresses.json`, `sample_addresses.csv` | `data/data/sample_addresses.csv` | — |
| `corpus.json` | `data/corpus/corpus_manifest.csv` (retrieval dates) | — |
| `hero.json` | three addresses picked by predicate from the lookups above, with their results on every date (~20 KB, for the landing stage) | empty list: the stage is not shown |
| `geo.json`, `address-dates.json` | written by `scripts/visual-data.mjs` from `derived/census/` and the lookups: metro maps (us-atlas county lines, addresses rounded to ~1 km) and result counts per address and date | empty: maps and the dates chart are not shown |
| `manifest.json` | the sources used, demo dates (parsed from `realrent/paths.py`) and warnings | — |

When any fixture is used, a **Fixture data** badge appears in the header.

## Landing videos and QR codes

The landing reads `web/landing.config.json`. `scripts/landing-media.mjs` runs before `dev` and `build`. It checks every entry and writes `public/data/landing.json`, plus one QR SVG per real destination under `public/data/qr/`. Nothing in the dashboard changes. Every field starts as `null`, and the page then shows "pending" placeholders instead of a video or a QR.

| Field | What to put there |
|---|---|
| `site_url` | Public https URL of the deployed site (for example the Vercel URL). It builds QR codes for local video files and the default demo link (`<site_url>/dashboard/`). |
| `demo.url` | Optional https link for the "Open the demo" QR. It overrides `site_url`. |
| `videos[].title`, `videos[].context` | Title and one-line context (EN/ES) shown beside the video. The three section clips (`how-it-works`, `five-results`, `change-over-time`; scripts in `docs/LANDING_CLIPS.md`) are already filled in. |
| `videos[].optional` | `true` marks a clip the story can do without. It shows an "Optional" tag. |
| `videos[].src` | An MP4 (H.264) under `web/public/media/` (for example `media/product-demo.mp4`), or an https URL to an MP4 file. It plays in a native player with controls and no autoplay. |
| `videos[].url` | Optional https page for the video (YouTube, Drive and so on). It is used for the button and the QR. |
| `videos[].poster` | A JPG or PNG under `web/public/media/`, or an https URL. |
| `videos[].duration` | Text such as `"0:54"`. Measure it from the final file, for example with `ffprobe`. |
| `videos[].captions.en` / `.es` | WebVTT (`.vtt`) files under `web/public/media/`. |
| `videos[].transcript.en` / `.es` | Plain-text transcripts (`.txt`) under `web/public/media/`. |

A local path that does not exist is reported as a build warning and shown as pending. QR codes are generated only for https destinations, with `qrcode-generator` (MIT, no dependencies, build-time only). On phones the landing shows an "open" button and hides the QR.

## Deploy on Vercel

1. Import the repo, then set **Root Directory** to `web`. The framework preset is Next.js.
2. Keep the default build command, `npm run build`. Vercel clones the whole repo, so `../submission` and `../derived` are available during the build.
3. Set no environment variables. Redeploy after the pipeline outputs change.
