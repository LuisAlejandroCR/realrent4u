<!--
AGENTS.md: instrucciones para agentes de código en realrent4u — qué se construye, criterios de
aceptación, formatos de salida, convenciones y ciclo de verificación.
Se distingue de README.md (presentación pública para jueces): aquí van las reglas de trabajo.
-->

# AGENTS.md — realrent4u

Rental Housing Law Navigator (Hack-Nation 7, Challenge 2 · RealPage). Submissions close
**Sun 2026-10-04 09:00 ET**. If this file and the organizer disagree, the organizer wins.

## Work cycle

Specify → Plan → Tasks → Implement → **Verify**. Nothing is done until it is verified against the
acceptance criteria below (tests pass and the change is exercised for real). If it can't be
verified, report "work in progress".

## Data (`data/`, official starter pack — never edit)

| Path | Contents |
|---|---|
| `data/corpus/corpus_manifest.csv` | 87 docs: `doc_id, jurisdictions, url, source_type, capture, retrieved_at, sha256, text_file, status` |
| `data/corpus/text/Dxxx.txt` | Full text of the 54 captured docs |
| `data/corpus/links_only.csv` | The 33 link-only docs (no text) |
| `data/data/sample_addresses.csv` | ~500 addresses: street, postal city, ZIP, year, units, use — **no legal jurisdiction** |
| `data/schema/rule_record.schema.json` | Rule JSON Schema (+ `sample_rule_record.json`) |
| `data/dev/change_tests.json` | Change tests T1–T5 (T6 arrives at hour 16) |
| `data/submission_templates/` | Shapes of `rules.json`, `lookups.json`, `changes.json` |
| `data/README.md` | Participant guide |

The pack ships **without** `score.py` and the dev key. Until they arrive, self-evaluate with tests
against T1–T5.

## Fixed by the organizer

- **Default query date: 2026-10-01.**
- **Result values (exact):** `applies` · `unknown` · `superseded` · `not_yet_effective` · `pending`.
  Rules that don't apply are **omitted** from `lookups.json`.
- **Rule status:** `in_force | not_yet_effective | pending | failed`.
- **Required rule fields:** `team_rule_id, jurisdiction` (`'CA'` or `'City, ST'`), `level`
  (`state | city`), `category, status, title, requirement, citation, source_url, quoted_span`.
  Optional: `key_value, coverage_conditions, exemptions, overrides`, among others.
- `lookups.json = {as_of, lookups: {address_id: [{team_rule_id, result, explanation, conflict_flag}]}}`
- `changes.json = {test_id: {affected_address_ids, conflict_flag_address_ids, notes}}`
- **Automated extraction only.** No hand-written rules. Checked live with a fictional ordinance at
  hour 16 and a re-run during the demo.

## Acceptance criteria

| # | Criterion | How it's tested |
|---|---|---|
| A1 | The 3 JSON files validate against the schema and templates; `score.py` runs clean | Validator; `python score.py` on dev set |
| A2 | One command regenerates `rules.json` from the corpus, no manual edits | Delete `rules.json`, re-run, same score |
| A3 | Every `quoted_span` exists verbatim in its source document | Substring test per rule |
| A4 | Legal jurisdiction, not postal city; stack state → county → city | Dorchester → Boston, San Ysidro → San Diego |
| A5 | Local rule that displaces state rule → state rule `superseded`, with reason | SF 1962: SF Rent Ordinance `applies`, §1947.12 `superseded` |
| A6 | Coverage depends on a missing fact → `unknown` with reason; never guess | San Diego no year; Berkeley no year/units |
| A7 | Date-based queries (`as_of`) | T1: AB 325 `not_yet_effective` at 2025-12-31, `applies` at 2026-01-02 |
| A8 | Local prohibition applies only inside its city | T2: Hoboken and Jersey City yes; Newark no |
| A9 | Signed-not-effective law + conflict flag with local rules | T3: NJ FAIR Act `not_yet_effective` now, `applies` 2027-07-02, conflicts with the 2 local bans |
| A10 | Bills are `pending`, never in force, with addresses they would reach | T4: MA S.2983 / H.5222 |
| A11 | Struck measure = no rule; empty affected set | T5: Boston and Cambridge, no rent cap |
| A12 | New ordinance extracted unaided in minutes, with its future date | T6 (hour 16): run pipeline, regenerate `changes.json` |
| A13 | Every screen says "not legal advice" and shows the "as of" date | Visual check + API test |
| A14 | Auditable log per run: source, model output and change per rule | Log file per run |
| A15 | With no LLM key, address lookup still works; only Explain degrades to a template | Test with the env var empty |

## Rules of the domain

- **When in doubt between `applies` and "doesn't apply", answer `unknown`.** Missing an `applies`
  costs double; `unknown` earns partial credit.
- **Year built ≠ certificate of occupancy.** SF cutoff 1979-06-13, LA 1978-10-01: a building from
  the cutoff year is `unknown`.
- **Known gaps → `unknown` with reason:** San Diego and Berkeley have no year; Berkeley, Boston `A/`,
  Jersey City, Newark and 39/40 Hoboken have no units; some NJ years missing; **no owners** (small-
  landlord exemption never resolves). Santa Ana is in the corpus but has no addresses.
- Classify `status` from the text and the manifest, never from model memory.
- **Bonus if surfaced:** contradictory effective dates (Berkeley ch. 13.63, LA RSO), possible FAIR
  Act preemption, CA screening-fee cap without an official 2026 figure.
- The system must never present itself as legal advice, suggest ways around a rule, invent rules or
  citations, or use non-public data / scrape against a site's terms.

## Plan

```text
A · Extract   one LLM call per doc, structured output = official schema ─► validate ─► quote check ─► rules.json
              raw model outputs cached on disk; never re-call for a doc already extracted
B · Resolve   Census Geocoder batch (no key, up to 10,000 addresses) ─► incorporated place
              no match ─► unknown, reason unresolved_address
    Apply     deterministic engine: rule × building facts × as_of
    Explain   constrained LLM or template, EN / ES, with citation and "as of"
C · Track     lookups before/after each change ─► changes.json
```

## Commands

| Command | What it does |
|---|---|
| `uv run pytest -q` | All tests (no network, no LLM) |
| `uv run python -m realrent.validate` | Validate `submission/*.json`; `--init` writes empty valid files |
| `uv run python -m realrent.extract` | Module A: extract all docs → `submission/rules.json` (needs `ANTHROPIC_API_KEY`) |
| `uv run python -m realrent.extract --offline` | Rebuild `rules.json` from cached outputs in `runs/raw/` only |
| `uv run python -m realrent.extract --only D001 --force` | Re-call the model for specific docs |

Raw model outputs (`runs/raw/`) and audit logs (`runs/extract-*.jsonl`) are committed: they are the
evidence that extraction is automated.

## Stack

- **Pipeline:** Python + pytest (extraction, engine, organizer's `score.py`).
- **Demo:** Next.js on Vercel (event rule: Vercel, Replit or Lovable). Reads the precomputed JSON;
  no Python server or model API needed at runtime.

## Scoring (where time goes)

25 extraction · 20 address coverage · 15 citations · 15 change tracking · 10 plain language ·
10 responsible design · 5 scalability.

## Conventions

- **Commits:** one line, `type: description`, Conventional Commits, English. No body, no trailers,
  never `Co-Authored-By`.
- **File headers:** code starts with `// <filename>: <what it does>` (or `#` in Python), 2–3 lines.
  `.md` files start with a 3–4 line HTML comment in Spanish saying what the file holds and which
  file it is distinguished from.
- **Secrets:** API keys only via env vars; never commit `.env`.
