<!--
PLAN.md: plan de trabajo en paralelo — workstreams, un PR por workstream, dueño de cada archivo,
contratos entre ellos, prompts listos para agentes en la nube y orden de merge.
Se distingue de AGENTS.md (reglas permanentes y criterios de aceptación): aquí va quién hace qué y cuándo.
-->

# Parallel plan — one workstream, one PR

North star: the v5 brief in `data/`. Acceptance criteria and conventions: [AGENTS.md](../AGENTS.md).

## Where the time goes

**Backend is the long pole.** Rough agent-hours, serial:

| Area | Work | Hours |
|---|---|---|
| Backend | A extraction run + tuning (3) · B resolve (1.5) · B apply engine (4) · C changes (1.5) · explain (1) · final integration (1) | **~12** |
| Frontend | Static demo reading precomputed JSON | **~3** |
| Docs | Method note + README run section | ~1 |

**Critical path:** W1 extraction quality → W3 engine on real rules → W4 changes → W8 freeze. Everything
else runs alongside. W3 is the single biggest risk: coverage logic per category, precedence and
`unknown` reasons.

## Workstreams

Each workstream is one branch and one PR against `main`. **Only touch the files you own.** Shared
files (`AGENTS.md`, `README.md`, `realrent/paths.py`, `realrent/contracts.py`, `pyproject.toml`) change
only in W0, W7, W8 — other PRs list new commands or dependencies in the PR description instead.

| ID | Branch | Owns | Starts when | Needs | Runs where |
|---|---|---|---|---|---|
| W0 | `chore/parallel-plan` | `docs/PLAN.md`, `realrent/contracts.py`, `tests/fixtures/`, `.github/workflows/` | now | — | local (this PR) |
| W1 | `feat/extract-run` | `realrent/extract.py`, `runs/`, `submission/rules.json`, `data_extra/` | W0 merged | `ANTHROPIC_API_KEY` (~$5–12) | local or cloud with the key |
| W2 | `feat/resolve` | `realrent/resolve.py`, `derived/jurisdictions.json`, `tests/test_resolve.py` | W0 merged | network to `geocoding.geo.census.gov` | cloud |
| W3 | `feat/engine` | `realrent/engine.py`, `realrent/lookups.py`, `submission/lookups.json`, `derived/lookups/`, `tests/test_engine.py` | W0 merged | — | cloud |
| W4 | `feat/changes` | `realrent/changes.py`, `submission/changes.json`, `tests/test_changes.py` | W0 merged | — | cloud |
| W5 | `feat/explain` | `realrent/explain.py`, `tests/test_explain.py` | W0 merged | optional key | cloud |
| W6 | `feat/web` | `web/**` | W0 merged | Vercel account (deploy) | cloud |
| W7 | `docs/method-note` | `docs/METHOD.md`, `README.md` | W1–W4 merged | — | cloud |
| W8 | `chore/final-run` | `submission/*`, `derived/*`, `AGENTS.md` | everything merged | key, network | local |

## Contracts (frozen in W0)

| Artifact | Shape | Producer → consumers |
|---|---|---|
| `submission/rules.json` | `{"rules": [...]}`, official schema + `coverage_conditions` object (`built_cutoff_date`, `built_cutoff_basis`, `built_cutoff_direction`, `min_units`, `exempts_small_owner_occupied`, `displaces_state_rule`, `text`) + `penalty`, `retrieved_at` | W1 → W3, W4, W5, W6 |
| `derived/jurisdictions.json` | `{address_id: Jurisdiction}` — see `realrent/contracts.py` | W2 → W3, W6 |
| `engine.evaluate(rules, address_row, jurisdiction, as_of) -> list[LookupItem]` | see `realrent/contracts.py`; rules that don't apply are omitted | W3 → W4, W6 (via files) |
| `submission/lookups.json`, `derived/lookups/<as_of>.json` | official lookups shape, one file per date in `paths.DEMO_DATES` | W3 → W4, W6 |
| `explain.explain(rule, item, lang) -> str` | `lang` in `{"en", "es"}`; template when no key | W5 → W3 (optional), W6 |

**Until a producer merges, consumers use the fixtures:** `tests/fixtures/rules.json` (10 hand-made
rules covering T1–T5 and SF precedence — tests only, never submitted) and
`tests/fixtures/jurisdictions.json` (11 addresses, one per city plus Dorchester and San Ysidro).
W4 takes `evaluate` as a parameter so it can test with a stub before W3 lands.

## Known traps (read before starting)

1. **T2 and T5 sources are link-only.** The Hoboken and Jersey City bans (D032–D035) and the struck MA
   ballot question (D059) have no text in the pack. W1 options, in order: (a) find support in captured
   text (e.g. MA's statewide bar on local rent control in G.L. ch. 40P, D048, for T5); (b) fetch only
   those few pages individually, respecting each site's terms, saved under `data_extra/text/` with URL
   and retrieval date, and run the same extractor. **No bulk scraping.** Decide with the team before (b).
2. **Postal data lies on purpose.** A0003 (Newark) has a Brooklyn ZIP, A0008 (Jersey City) a Texas ZIP;
   Boston rows say Dorchester, Roxbury… Resolve by street + city + state, fall back to a postal-city
   map, and record `match`.
3. **Missing facts → `unknown` with a reason**, never "doesn't apply" (AGENTS.md, Rules of the domain).
4. **Year built ≠ certificate of occupancy:** SF 1979, LA 1978 cutoff-year buildings are `unknown`.

## Merge order

`W0` → (`W1` ∥ `W2` ∥ `W3` ∥ `W4` ∥ `W5` ∥ `W6`) → `W7` → `W8`. CI (`pytest` + validator) must be green
on every PR. Rebase on `main` before merge; conflicts outside your owned files mean you touched
something you shouldn't.

## Agent prompts

Paste one per cloud session, on repo `LuisAlejandroCR/realrent4u`. Each prompt assumes the agent reads
`AGENTS.md` and this file first.

**W2 — Resolve**
> Read AGENTS.md and docs/PLAN.md (W2, Contracts, Known traps). On branch `feat/resolve`, implement
> `realrent/resolve.py`: batch-geocode all 500 rows of `data/data/sample_addresses.csv` with the Census
> Geocoder batch endpoint (geographies, Public_AR_Current / Current_Current), map the incorporated place
> to one of the 10 in-scope cities, fall back to a postal-city map (Boston neighborhoods → Boston, San
> Ysidro → San Diego) when Census has no match, and write `derived/jurisdictions.json` matching
> `contracts.Jurisdiction`. Cache the raw Census response under `derived/census/`. Tests must not hit
> the network (use the cached response or fixtures) and must check Dorchester → Boston, San Ysidro →
> San Diego, and the bad-ZIP rows A0003 and A0008. Open a PR; list the command in the description.

**W3 — Engine and lookups**
> Read AGENTS.md and docs/PLAN.md (W3, Contracts, Known traps). On branch `feat/engine`, implement
> `realrent/engine.py` with `evaluate()` per `realrent/contracts.py` and `realrent/lookups.py` that
> writes `submission/lookups.json` (as_of 2026-10-01, all 500 addresses) and `derived/lookups/<date>.json`
> for each date in `paths.DEMO_DATES`. Logic: a rule is a candidate if its jurisdiction is the address's
> state or its `"City, ST"`; status/effective date vs as_of decide `pending` / `not_yet_effective` /
> `applies` (failed rules never appear); coverage conditions (built cutoff with basis and direction,
> min units, small-owner exemption) give `unknown` with a `reason` when the needed fact is missing or in
> the cutoff year for certificate-of-occupancy cutoffs; a local rule with `overrides` makes those state
> rules `superseded`; conflict notes set `conflict_flag`. Develop against `tests/fixtures/` until real
> rules exist. Tests: SF 1926 building → SF ordinance applies and state cap superseded; San Diego with
> no year → unknown; Newark gets neither local ban; MA never gets a rent cap. Open a PR.

**W4 — Change tracking**
> Read AGENTS.md and docs/PLAN.md (W4, Contracts). On branch `feat/changes`, implement
> `realrent/changes.py` that reads `data/dev/change_tests.json`, maps each test's rule_ids
> (CA-ALG-01, HOB-ALG-01, …) to our rules by jurisdiction + category + status/citation, runs an injected
> `evaluate` at the test's dates, and writes `submission/changes.json` with `affected_address_ids`,
> `conflict_flag_address_ids` and `notes` per test. Rules: T1 = CA addresses whose result flips
> not_yet_effective → applies; T2 = Hoboken/Jersey City only; T3 = all NJ, conflict flags on Hoboken and
> Jersey City; T4 = MA addresses the pending bills would reach; T5 = empty. Test with a stub evaluate
> and `tests/fixtures/`. Open a PR.

**W5 — Explain EN/ES**
> Read AGENTS.md and docs/PLAN.md (W5, Contracts). On branch `feat/explain`, implement
> `realrent/explain.py`: `explain(rule, item, lang)` returning one or two plain sentences in English or
> Spanish that state the result, the reason when unknown/superseded, the citation and the as-of date,
> and end with "Not legal advice" / "No es asesoría legal". Template-based by default; an optional
> Claude call (model `claude-opus-5-5`) only rewrites the template and must keep citation and date.
> Never suggest how to avoid a rule. Tests run without a key. Open a PR.

**W6 — Web demo**
> Read AGENTS.md, docs/PLAN.md (W6, Contracts) and docs/DESIGN.md (tokens, pages, language). On
> branch `feat/web`, build a static Next.js app in
> `web/` deployable to Vercel: search an address from the 500 samples, pick a date from
> `paths.DEMO_DATES`, show each rule with result, plain-language explanation, citation, quoted span,
> source link, retrieval date and as-of date; EN/ES toggle; a change-tests page for T1–T5; "Not legal
> advice" on every screen. A prebuild script copies `submission/*.json`, `derived/jurisdictions.json`,
> `derived/lookups/` and the addresses CSV into `web/public/data/`; fall back to `tests/fixtures/` when
> those files don't exist yet. No server, no API key at runtime. Open a PR with a screenshot.

**W7 — Method note**
> After W1–W4 merge: write `docs/METHOD.md`, one page: extraction (model, schema, quote check, audit
> log), resolution (Census + fallback), apply logic and precedence, `unknown` policy, change tracking,
> limits. Add a "Run it" section to README.md. Open a PR.
