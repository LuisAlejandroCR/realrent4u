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

URL params: `?lang=es&date=2027-07-02`. The address goes in the hash: `/#A0016`.

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
| `manifest.json` | the sources used, demo dates (parsed from `realrent/paths.py`) and warnings | — |

When any fixture is used, a **Fixture data** badge appears in the header.

## Deploy on Vercel

1. Import the repo, then set **Root Directory** to `web`. The framework preset is Next.js.
2. Keep the default build command, `npm run build`. Vercel clones the whole repo, so `../submission` and `../derived` are available during the build.
3. Set no environment variables. Redeploy after the pipeline outputs change.
