<!--
README.md: puerta de entrada pública de realrent4u para jueces y visitantes, organizada por los tres
criterios de evaluación (profundidad técnica, comunicación, innovación) y con cómo correr todo.
Se distingue de docs/METHOD.md (la nota de método de una página que exige el brief).
-->

# realrent4u — Rental Housing Law Navigator

> **Which rental rules apply to this address, on this date, and where does it say so?**

**Live demo:** https://realrent4u.vercel.app · Hack-Nation 7 (Oct 3–4, 2026), Challenge 2 (RealPage) ·
**Not legal advice.**

Type a sample U.S. address and pick a date. realrent4u places the building in its **legal** city (not its
postal one), checks every rental rule against the building's facts and the date, and answers with one of five
labelled results, the exact quoted sentence, its source and the date it was read. When a fact is missing, the
answer is **unknown**, never a guess.

| | |
|---|---|
| Coverage | California · New Jersey · Massachusetts — 9 cities with sample addresses, 12 jurisdictions with rules |
| Data | 87 public documents (54 with full text) + 3 team-fetched · 500 sample addresses |
| Output | 85 rules · 9,332 results on 2026-10-01 · 4 as-of dates · change tests T1–T5 |
| Deliverables | [`submission/rules.json`](submission/rules.json) · [`lookups.json`](submission/lookups.json) · [`changes.json`](submission/changes.json) · [`docs/METHOD.md`](docs/METHOD.md) |

---

## 1 · Technical depth

```text
A · Extract   87 documents ─► Claude (claude-opus-5-5), one call per document, official rule schema
              ─► schema validation ─► quote check: the quoted span must appear verbatim in the source
              ─► 85 rules (submission/rules.json); raw outputs cached in runs/raw/, one audit log per run
B · Resolve   500 addresses ─► U.S. Census Geocoder ─► legal jurisdiction (state → county → city)
              485 exact matches, 15 by postal fallback; responses cached in derived/census/
  · Apply     deterministic engine: rule × building facts × as-of date ─► applies | unknown |
              superseded | not_yet_effective | pending, with precedence and conflict flags
  · Explain   EN/ES plain language: template, reworded by Claude, kept only if citation, date and
              disclaimer survive; 700 rewrites cached in runs/explain/
C · Track     lookups before/after each change ─► affected addresses + conflict flags ─► changes.json
```

**Key decisions**

- **The model extracts; it never decides.** Results come from a deterministic engine, so the same inputs always
  give the same answer and every answer can be traced to a rule and a quote.
- **No invented citations.** A rule whose quote is not found word for word in its source is dropped and logged
  (111 of 112 quotes verified).
- **`unknown` is a first-class result.** Missing year built or units, a cutoff-year building (SF 1979, LA 1978),
  or an unresolvable owner exemption returns `unknown` with the missing fact named.
- **Legal city, not postal city.** Dorchester → Boston, San Ysidro → San Diego. 38 sample addresses differ.
- **Local over state, with a reason.** SF 1926 building: the SF Rent Ordinance applies, Civil Code §1947.12 is
  `superseded`. NJ FAIR Act (effective 2027-07-01) flags 90 addresses where it may clash with Hoboken and Jersey
  City bans.
- **Reproducible.** `uv run python -m realrent.pipeline` rebuilds everything offline from the caches;
  `--check` fails if any committed output would change. CI runs tests, validation and `--check` on every PR and push to main.

**Verification**

| Check | Result |
|---|---|
| `uv run pytest -q` | 180 tests, no network, no API key |
| `uv run python -m realrent.validate` | the three JSON files validate against the official schema and templates |
| `uv run python -m realrent.pipeline --check` | regenerated outputs are identical to the committed ones |
| Web, Playwright (desktop + mobile) | end-to-end tests: legal notice and as-of date on every screen, search, maps, tests |
| Change tests (affected / flagged) | T1 250/0 · T2 90/90 · T3 140/90 · T4 110/0 · T5 0/0 (confirmed empty) |

## 2 · Communication

- **Every answer carries its evidence:** result label, plain-language reason, quoted text, citation, source link,
  retrieval date and as-of date. Every screen says **"Not legal advice"** and shows the as-of date.
- **Show, don't tell.** The landing replays three real addresses across the four dates; the dashboard opens on a
  "Start here" roadmap and a bubble map of the sample, shows each address as a soft circle on a street map (rounded
  to ~1 km, never a pin) with the postal city struck and the legal one stamped, groups its rules by outcome, charts
  its results on every date, draws T1–T5 on one date axis, and shows the method as a pipeline diagram with counts
  read from the build. Every chip, tile and map dot filters or opens something.
- **Five results, never colour alone:** each has a written label and its own marker shape.
- **English and Spanish** in the web app, the explanations and the video subtitles.
- **Videos** (≤ 60 s each, EN/ES subtitles): product demo, technical walkthrough, team.

## 3 · Innovation and creativity

- **Address × date as the interface.** Moving one date picker shows a law switching from *not yet effective* to
  *applies*, and a bill staying *pending*: the time dimension of housing law made visible.
- **Change tests you can run.** Each test T1–T5 is recomputed in the browser from the precomputed lookups and
  checked against `changes.json`, then mapped: Hoboken and Jersey City lit, Newark next door left empty.
- **Trustworthy AI by construction:** verbatim quote checks, cached and audited model output, a deterministic
  engine, and `unknown` instead of a guess.
- **Runs anywhere, no keys:** the web app and the Expo mobile app (iOS/Android) read static JSON; no server and no
  API key at runtime.

---

## Run it

Python 3.12+ with [uv](https://docs.astral.sh/uv/), Node 20+.

```bash
uv sync
```

```bash
uv run python -m realrent.pipeline
```

| Step | Command | Needs |
|---|---|---|
| A · Extract | `uv run python -m realrent.extract` (`--offline` rebuilds from `runs/raw/`, `--only D001 --force` redoes one document) | `ANTHROPIC_API_KEY` (not for `--offline`) |
| B · Resolve | `uv run python -m realrent.resolve` (`--offline` reads `derived/census/`) | network (not for `--offline`) |
| B · Apply | `uv run python -m realrent.lookups` | — |
| C · Track | `uv run python -m realrent.changes` | — |
| Validate | `uv run python -m realrent.validate` | — |

Without an API key everything works except a fresh extraction; explanations reuse `runs/explain/`.

**Web** (static Next.js, deployed on Vercel with root directory `web`):

```bash
cd web && npm install && npm run build
```

The build copies the pipeline outputs into `web/public/data/` and precomputes the maps and charts.
`npm run dev` serves it on http://localhost:3000.

**Mobile** (Expo, optional): `cd mobile && npm install && npm start`, then open it in Expo Go.

## Repository

| Path | Contents |
|---|---|
| `data/` | Official starter pack (never edited): corpus, addresses, schema, change tests, templates |
| `data_extra/` | Three team-fetched public documents and their provenance |
| `realrent/` | Pipeline: extract, resolve, engine, lookups, changes, explain, validate |
| `runs/` | Evidence of automated extraction: raw model outputs, audit logs, cached explanation rewrites |
| `derived/` | Jurisdictions, cached Census responses, lookups for each as-of date |
| `submission/` | The three deliverable JSON files |
| `web/`, `mobile/` | The two apps; `web/scripts/videos/` rebuilds the submission videos |
| `tests/` | pytest suite and fixtures (never submitted) |

## Responsible use

An information tool built only on public documents. It does not give legal advice, certify compliance, suggest
ways around a rule, or invent rules where the source is silent.
