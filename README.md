<!--
README.md: puerta de entrada pública de realrent4u — qué hace, cómo está armado y qué entrega.
Se distingue de AGENTS.md (instrucciones y criterios para agentes de código): aquí va lo que lee
un juez o un visitante, no reglas de trabajo.
-->

# realrent4u — Rental Housing Law Navigator

> **Which rules apply here today, and what is about to change?**

Built for **Hack-Nation 7 — Global AI Hackathon** (Oct 3–4, 2026), Challenge 2 sponsored by
**RealPage**.

Type a U.S. address and a date. realrent4u tells you which rental-housing rules apply there, which
one governs when the city and the state disagree, and what would change under a new or pending
law — every answer backed by a citation and the exact quoted text from the source.

**Not legal advice.** Every result shows the date it is valid "as of" and links to its source.

## Scope

| | |
|---|---|
| States | California · New Jersey · Massachusetts |
| Cities | Los Angeles, San Francisco, San Diego, Berkeley, Santa Ana · Jersey City, Hoboken, Newark · Boston, Cambridge |
| Categories | Rent increase limits · Just-cause eviction · Security deposits · Application & screening fees · Screening restrictions · Algorithmic rent-setting |
| Corpus | 87 documents (54 with full text) · ~500 addresses |

## How it works

```text
A · Extract   corpus ─► LLM with structured output (official rule schema) ─► validate ─► rules.json
                         └─ every quoted span must exist verbatim in its source, or the rule is dropped
B · Resolve   address ─► U.S. Census Geocoder ─► legal jurisdiction (state → county → city)
    Apply     rule × building facts × as_of ─► applies | unknown | superseded | not_yet_effective | pending
    Explain   applicable rules ─► plain language (EN / ES) + citation + "as of" date
C · Track     change ─► lookups before/after ─► affected addresses + conflicts ─► changes.json
```

**Design principles**

- **The model extracts and writes; everything else is deterministic.** Rules are extracted
  automatically from the corpus — none are written by hand.
- **No invented citations.** A rule whose quote cannot be found literally in its source document is
  discarded and logged.
- **When in doubt, `unknown`.** If coverage depends on a missing fact (year built, unit count,
  owner), the answer is `unknown` with the reason — never a guess.
- **Legal jurisdiction, not postal city.** Dorchester resolves to Boston; San Ysidro to San Diego.
- **Works without the LLM.** Address lookups read the precomputed `rules.json`; only the
  plain-language explanation degrades to a template.

## Deliverables

| File | Contents |
|---|---|
| `rules.json` | Extracted rules, one record per rule, validated against the official schema |
| `lookups.json` | Results for all addresses at the default date (2026-10-01) |
| `changes.json` | Affected addresses and conflict flags for each of the five change tests (T1–T5) |
| [`docs/METHOD.md`](docs/METHOD.md) | One-page method note: how rules are extracted, resolved, applied and tracked |

## Repository layout

| Path | Contents |
|---|---|
| `data/` | Official starter pack: corpus, addresses, rule schema, change tests, submission templates |
| `realrent/` | Python pipeline: extract, resolve, engine, lookups, changes, explain, validate |
| `tests/` | pytest suite and hand-made fixtures (fixtures are never submitted) |
| `runs/` | Cached raw model outputs (`runs/raw/`) and one audit log per extraction run |
| `derived/` | Jurisdictions per address, cached Census responses, lookups per demo date |
| `submission/` | The three deliverable JSON files |
| `web/` | Static Next.js demo that reads the precomputed JSON ([web/README.md](web/README.md)) |
| `docs/` | Method note, parallel plan, web design system, video scripts |
| `AGENTS.md` | Spec, acceptance criteria and conventions for anyone (human or agent) working on the code |

## Run it

Needs Python 3.12+ with [uv](https://docs.astral.sh/uv/), and Node 20+ for the web demo.

```bash
uv sync                               # install the pipeline and test dependencies
uv run pytest -q                      # all tests: no network, no API key
uv run python -m realrent.validate    # check submission/*.json against the schema and templates
```

**One command:** `uv run python -m realrent.pipeline` runs the steps below in order. It lands with
the `chore/pipeline` branch (not merged yet); until then, run the steps one by one.

**Step by step**

| Step | Command | Writes | Needs |
|---|---|---|---|
| A · Extract | `uv run python -m realrent.extract` | `submission/rules.json`, `runs/raw/`, `runs/extract-*.jsonl` | `ANTHROPIC_API_KEY` |
| A · Rebuild offline | `uv run python -m realrent.extract --offline` | `submission/rules.json` from `runs/raw/`, no model call | cached outputs in `runs/raw/` |
| A · Redo some docs | `uv run python -m realrent.extract --only D001 --force` | same, re-calling the model for those docs | `ANTHROPIC_API_KEY` |
| B · Resolve | `uv run python -m realrent.resolve` | `derived/jurisdictions.json`, `derived/census/` | network to `geocoding.geo.census.gov` |
| B · Resolve offline | `uv run python -m realrent.resolve --offline` | same, from the cached Census responses | — |
| B · Apply | `uv run python -m realrent.lookups` | `submission/lookups.json`, `derived/lookups/<date>.json` | `rules.json`, `jurisdictions.json` |
| C · Track | `uv run python -m realrent.changes` | `submission/changes.json` (`--dry-run` prints instead) | same |
| Validate | `uv run python -m realrent.validate` | nothing (`--init` overwrites with empty valid files) | — |

Without an API key everything above except a fresh extraction works. Explanations are templates; set
`REALRENT_LLM_EXPLAIN=1` with a key to let Claude reword them (the rewrite is kept only if citation,
as-of date and disclaimer survive). If `rules.json` is ever empty, `lookups` uses the test fixtures
for `derived/lookups/` only and leaves `submission/lookups.json` alone, and `changes` prefixes its
notes with `[FIXTURE INPUT, not a submission]`: never submit that output.

**Web demo**

```bash
cd web && npm install && npm run build   # copies the pipeline JSON into web/public/data/, static site in web/out/
npm run dev                              # from web/: local preview on http://localhost:3000
```

Deploy notes (Vercel) are in [web/README.md](web/README.md).

## Status

Extraction, resolution, apply engine, change tracking, explanations and the web demo are merged, and
`submission/rules.json` holds 82 extracted rules. `lookups.json` and `changes.json` are still the
empty placeholders until the final run regenerates them. [docs/METHOD.md](docs/METHOD.md) says what
is done and what is still open.

## Responsible use

realrent4u is an information tool. It does not certify compliance, does not suggest ways around a
rule, and does not invent rules where the source is silent. Only public documents are used.
