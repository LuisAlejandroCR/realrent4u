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

## Routes

| Route | Page |
|---|---|
| `/` | Search over the 500 sample addresses and the as-of date pills. A match opens its address page. |
| `/a/<id>/` | One static page per address (`generateStaticParams` over `public/data/addresses.json`): plate, building facts, date pills, results by category. |
| `/changes/` | The change tests T1–T5; each address links to its `/a/<id>/` page. |
| `/method/` | `docs/METHOD.md` rendered to HTML at build time (`marked`). While the file is missing the page says the note is not published yet. |
| `/about/` | Reasoning boundary, result legend and which data files this build used. |

URL params work on every route: `?lang=es&date=2027-07-02`. When the visitor arrives with them, in-app links keep them and the toggles update them. Old links of the form `/#A0016` redirect to `/a/A0016/`. Every page shows "Not legal advice" and the as-of date.

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
| `METHOD.md` | `docs/METHOD.md` | none: `/method` shows "Method note not published yet" |
| `manifest.json` | the sources used, demo dates (parsed from `realrent/paths.py`) and warnings | — |

When any fixture is used, a **Fixture data** badge appears in the header.

## Deploy on Vercel

1. In Vercel, choose **Add New → Project** and import `LuisAlejandroCR/realrent4u`.
2. Set **Root Directory** to `web`. Leave "Include files outside the root directory in the Build Step" on (the default): the prebuild step reads `../submission`, `../derived`, `../data`, `../docs` and `../realrent/paths.py`.
3. Keep the detected **Next.js** preset and the default commands (`npm install`, `npm run build`). `next.config.mjs` sets `output: "export"` and `trailingSlash: true`, so no `vercel.json` is needed.
4. Set no environment variables, then deploy. Redeploy (or push to `main`) after the pipeline outputs or `docs/METHOD.md` change.

The export is plain files (`out/a/A0016/index.html`, …), so any static host that serves a folder's `index.html` works. Tested locally with `npm run serve` and with `python3 -m http.server`, which redirects `/a/A0016` to `/a/A0016/`.
